import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, User, Briefcase, Camera, CheckCircle2, Signature, Star, Download, FileText, QrCode, ShieldCheck, Video, MessageSquare, Send, Phone } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase, uploadDeliveryPhoto } from '../../lib/supabase';
import { uploadVideoToCloudinary } from '../../lib/cloudinary';
import { sendFenixGuideAfterDelivery, logWhatsAppMessage, getCustomerPhone, openWhatsAppDirect, buildWhatsAppDirectUrl } from '../../utils/whatsapp';

interface Delivery {
  id: string;
  order_number: string;
  nf_number: string;
  status: string;
  customer_id?: string;
  expedition_id?: string;
  customer_name?: string;
  arrival_at?: string;
  signed_at?: string;
  finished_at?: string;
  signer_name?: string;
  signer_document?: string;
  signer_role?: string;
  signature_gps?: string;
  signature_ip?: string;
  signature_data?: string;
  checklist: {
    unloaded: boolean;
    installed: boolean;
    tested: boolean;
    working: boolean;
    trained: boolean;
  };
  delivery_notes?: string;
}

interface Photo {
  id: string;
  photo_type: string;
  public_url: string;
  captured_at: string;
}

interface Video {
  id: string;
  public_url: string;
  captured_at: string;
}

interface DeliveryDetailProps {
  mode?: 'view' | 'edit';
}

const requiredPhotos = [
  { key: 'estetica', label: 'Foto da estética' },
  { key: 'placa', label: 'Foto da placa' },
  { key: 'carga', label: 'Foto da carga' },
  { key: 'acessorios', label: 'Foto dos acessórios' },
  { key: 'instalacao', label: 'Foto da instalação' },
  { key: 'equipamento', label: 'Foto do equipamento funcionando' },
  { key: 'final', label: 'Foto final da entrega' },
];

export const DeliveryDetail = ({ mode = 'view' }: DeliveryDetailProps) => {
  const isViewMode = mode === 'view';
  const { id } = useParams();
  const navigate = useNavigate();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState('');
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [selectedPhotoType, setSelectedPhotoType] = useState('');
  const [currentUploadType, setCurrentUploadType] = useState<'photo' | 'video'>('photo');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [signatureDocument, setSignatureDocument] = useState('');
  const [signatureRole, setSignatureRole] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [gps, setGps] = useState('');
  const [ip, setIp] = useState('');
  const [message, setMessage] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'entregue' | 'finalizado' | null>(null);
  const [feedbackDeliveryRating, setFeedbackDeliveryRating] = useState(5);
  const [feedbackInstallationRating, setFeedbackInstallationRating] = useState(5);
  const [feedbackServiceRating, setFeedbackServiceRating] = useState(5);
  const [feedbackEquipmentRating, setFeedbackEquipmentRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      const { data: deliveryData, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(error.message);
        setLoading(false);
        return;
      }

      if (!deliveryData) {
        console.warn(`Entrega não encontrada: ${id}`);
        setNotFound(true);
        setLoading(false);
        return;
      }

      let customerName = deliveryData.customer_name;

      if (!customerName && deliveryData.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('id', deliveryData.customer_id)
          .maybeSingle();

        if (!customerError && customerData) {
          customerName = customerData.name;
          if (customerData.phone) setManualPhone(customerData.phone);
        }
      }

      if (!customerName && deliveryData.expedition_id) {
        const { data: expeditionData, error: expeditionError } = await supabase
          .from('expeditions')
          .select('client_name')
          .eq('id', deliveryData.expedition_id)
          .maybeSingle();

        if (!expeditionError && expeditionData) {
          customerName = expeditionData.client_name;
        }
      }

      const { data: photoData } = await supabase
        .from('delivery_photos')
        .select('*')
        .eq('delivery_id', id)
        .neq('photo_type', 'video')
        .order('captured_at', { ascending: true });

      const { data: videoData } = await supabase
        .from('delivery_photos')
        .select('*')
        .eq('delivery_id', id)
        .eq('photo_type', 'video')
        .order('captured_at', { ascending: true });

      setDelivery({ ...deliveryData, customer_name: customerName });
      setPhotos(photoData ?? []);
      setVideos(
        (videoData ?? []).map((v: any) => ({
          id: v.id,
          public_url: v.public_url,
          captured_at: v.captured_at,
        }))
      );
      setSignatureName(deliveryData.signer_name ?? '');
      setSignatureDocument(deliveryData.signer_document ?? '');
      setSignatureRole(deliveryData.signer_role ?? '');

      // Load last saved signature (from delivery object or digital_signatures table)
      if (deliveryData.signature_data) {
        setSignatureImage(deliveryData.signature_data);
      } else {
        try {
          const { data: sigRow } = await supabase
            .from('digital_signatures')
            .select('signature_data')
            .eq('delivery_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sigRow && (sigRow as any).signature_data) {
            setSignatureImage((sigRow as any).signature_data);
          } else {
            setSignatureImage(null);
          }
        } catch (err) {
          setSignatureImage(null);
        }
      }
      setLoading(false);
    };

    load();
    captureGeo();
    fetchIp();
  }, [id]);

  useEffect(() => {
    if (!delivery) return;
    const statusParam = searchParams.get('status');
    const feedbackParam = searchParams.get('feedback');

    // Only open feedback modal when flow explicitly requests it for "finalizado".
    if (feedbackParam === '1' && statusParam === 'finalizado') {
      setPendingStatus(statusParam);
      setShowFeedbackModal(true);
      setSearchParams({});
    }

    const value = `pedido=${delivery.order_number}&nf=${delivery.nf_number}&id=${delivery.id}`;
    QRCode.toDataURL(value)
      .then((url) => setQrCodeUrl(url))
      .catch(() => setQrCodeUrl(''));
  }, [delivery]);

  const captureGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setGps(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
    });
  };

  const fetchIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setIp(data.ip);
    } catch {
      setIp('Não disponível');
    }
  };

  const handlePhotoTypeSelect = (photoType: string) => {
    setSelectedPhotoType(photoType);
    setCurrentUploadType('photo');
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.capture = 'environment';
      fileInputRef.current.multiple = false;
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUploadType === 'photo') {
      await handlePhotoUpload(selectedPhotoType, event.target.files);
      setSelectedPhotoType('');
    } else if (currentUploadType === 'video') {
      await handleVideoUpload(event.target.files);
    }
    if (event.target) event.target.value = '';
  };

  const handleVideoUploadClick = () => {
    setCurrentUploadType('video');
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'video/*';
      fileInputRef.current.capture = 'camcorder';
      fileInputRef.current.multiple = false;
      fileInputRef.current.click();
    }
  };

  const handlePhotoUpload = async (photoType: string, fileList: FileList | null) => {
    if (!id || !fileList || fileList.length === 0 || !photoType) return;
    setUploading(photoType);
    setPhotoUploadProgress(0);

    try {
      const file = fileList[0];
      const { path, publicUrl } = await uploadDeliveryPhoto(id, file, photoType, {
        onProgress: (percent) => setPhotoUploadProgress(percent),
      });
      const existingPhoto = photos.find((photo) => photo.photo_type === photoType);

      if (existingPhoto) {
        const { error } = await supabase
          .from('delivery_photos')
          .update({ storage_path: path, public_url: publicUrl, captured_at: new Date().toISOString() })
          .eq('id', existingPhoto.id);
        if (error) throw error;

        setPhotos((prev) =>
          prev.map((photo) =>
            photo.photo_type === photoType
              ? { ...photo, public_url: publicUrl, storage_path: path, captured_at: new Date().toISOString() }
              : photo
          )
        );
      } else {
        const { error } = await supabase.from('delivery_photos').insert({ delivery_id: id, photo_type: photoType, storage_path: path, public_url: publicUrl });
        if (error) throw error;
        setPhotos((prev) => [...prev, { id: crypto.randomUUID(), photo_type: photoType, public_url: publicUrl, captured_at: new Date().toISOString() }]);
      }

      setMessage('Foto enviada com sucesso.');
    } catch (uploadError: any) {
      setMessage(uploadError?.message || 'Falha ao enviar foto.');
      console.error(uploadError);
    } finally {
      setUploading('');
    }
  };

  const handleVideoUpload = async (fileList: FileList | null) => {
    if (!id || !fileList || fileList.length === 0) return;
    setUploading('video');
    setVideoUploadProgress(0);

    try {
      const file = fileList[0];
      const uploadResult = await uploadVideoToCloudinary(file, `deliveries/${id}`, {
        onProgress: (percent) => setVideoUploadProgress(percent),
      });

      // Persist to Supabase using delivery_photos with photo_type='video'
      const { data: savedVideo, error: saveError } = await supabase
        .from('delivery_photos')
        .insert([
          {
            delivery_id: id,
            photo_type: 'video',
            storage_path: uploadResult.public_id ?? uploadResult.secure_url,
            public_url: uploadResult.secure_url,
          },
        ])
        .select('id, public_url, captured_at')
        .single();

      if (saveError) {
        console.error('Erro ao salvar vídeo no banco:', saveError.message);
        setMessage('Vídeo enviado ao Cloudinary, mas falha ao salvar no banco.');
        return;
      }

      setVideos((prev) => [
        ...prev,
        {
          id: savedVideo.id,
          public_url: savedVideo.public_url,
          captured_at: savedVideo.captured_at,
        },
      ]);

      setMessage('Vídeo enviado com sucesso.');
    } catch (uploadError: any) {
      setMessage(uploadError?.message || 'Falha ao enviar vídeo.');
      console.error(uploadError);
    } finally {
      setUploading('');
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setMessage('');
  };

  const recordArrival = async () => {
    if (!id || !delivery) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('deliveries')
      .update({ arrival_at: now })
      .eq('id', id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDelivery({ ...delivery, arrival_at: now });
    setMessage('Chegada registrada com sucesso.');
  };

  const saveSignature = async () => {
    if (!id || !delivery) return;
    const canvas = signatureRef.current;
    if (!canvas || canvas.isEmpty()) {
      setMessage('Assinatura não pode ficar em branco.');
      return;
    }

    let dataUrl: string | null = null;
    try {
      if (signatureRef.current?.getTrimmedCanvas) {
        dataUrl = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
      } else if (signatureRef.current?.toDataURL) {
        dataUrl = signatureRef.current.toDataURL('image/png');
      } else if (signatureRef.current?.getCanvas) {
        dataUrl = signatureRef.current.getCanvas().toDataURL('image/png');
      }
    } catch (e) {
      console.error('Erro ao converter canvas para dataURL:', e);
    }

    if (!dataUrl) {
      setMessage('Falha ao capturar imagem da assinatura.');
      return;
    }

    const nameToUse = signatureName.trim() || delivery.customer_name || 'Cliente';
    const signedAt = new Date().toISOString();

    const { error } = await supabase
      .from('deliveries')
      .update({
        signer_name: nameToUse,
        signer_document: signatureDocument,
        signer_role: signatureRole,
        signature_gps: gps,
        signature_ip: ip,
        signed_at: signedAt,
        signature_data: dataUrl,
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar entrega com assinatura:', error);
      setMessage(`Erro ao registrar assinatura: ${error.message}`);
      return;
    }

    setDelivery({
      ...delivery,
      signer_name: nameToUse,
      signer_document: signatureDocument,
      signer_role: signatureRole,
      signature_gps: gps,
      signature_ip: ip,
      signed_at: signedAt,
      signature_data: dataUrl,
    });

    setSignatureImage(dataUrl);

    // save signature drawing to digital_signatures table (base64 data)
    try {
      const { error: sigError } = await supabase.from('digital_signatures').insert({
        delivery_id: id,
        signer_name: nameToUse,
        signer_document: signatureDocument,
        signer_role: signatureRole,
        gps_location: gps,
        ip_address: ip,
        signature_data: dataUrl,
      });

      if (sigError) {
        console.error('Erro ao salvar assinatura na tabela digital_signatures:', sigError);
      }
    } catch (e) {
      console.error('Erro ao salvar em digital_signatures:', e);
    }

    setMessage('Assinatura registrada com sucesso.');
  };

  const openFeedbackModal = (status: 'entregue' | 'finalizado') => {
    setPendingStatus(status);
    setShowFeedbackModal(true);
    setMessage('');
  };

  const submitFeedback = async () => {
    if (!id || !delivery || !pendingStatus) return;
    setLoading(true);

    const { data: currentDelivery, error: currentDeliveryError } = await supabase
      .from('deliveries')
      .select('id, expedition_id, customer_id, status')
      .eq('id', id)
      .maybeSingle();

    if (currentDeliveryError || !currentDelivery) {
      setMessage('Erro ao buscar entrega antes do feedback.');
      setLoading(false);
      return;
    }

    const { data: existingWarranty } = await supabase
      .from('warranties')
      .select('id')
      .eq('delivery_id', id)
      .maybeSingle();

    if (!existingWarranty) {
      const startDate = new Date().toISOString().slice(0, 10);
      const endDateObj = new Date();
      endDateObj.setMonth(endDateObj.getMonth() + 3);
      const endDate = endDateObj.toISOString().slice(0, 10);

      const { error: warrantyError } = await supabase.from('warranties').insert({
        delivery_id: id,
        expedition_id: currentDelivery.expedition_id,
        customer_id: currentDelivery.customer_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      });

      if (warrantyError) {
        // ignore unique-violation (already exists)
        if ((warrantyError as any).code !== '23505') {
          console.error('Erro ao criar garantia:', warrantyError);
        }
      }
    }

    const rating = Number(
      (
        (feedbackDeliveryRating +
          feedbackInstallationRating +
          feedbackServiceRating +
          feedbackEquipmentRating) /
        4
      ).toFixed(1)
    );

    const { error: feedbackError } = await supabase.from('feedbacks').insert({
      delivery_id: id,
      expedition_id: currentDelivery.expedition_id,
      customer_id: currentDelivery.customer_id,
      rating,
      comment: feedbackComments || 'Nenhum comentário informado.',
      delivery_rating: feedbackDeliveryRating,
      installation_rating: feedbackInstallationRating,
      service_rating: feedbackServiceRating,
      equipment_rating: feedbackEquipmentRating,
    });

    if (feedbackError) {
      setMessage('Erro ao salvar feedback.');
      console.error('Erro ao criar feedback:', feedbackError);
      setLoading(false);
      return;
    }

    const updatePayload: Record<string, any> = { status: pendingStatus };
    if (pendingStatus === 'finalizado') {
      updatePayload.finished_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('deliveries')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      setMessage('Erro ao atualizar status da entrega.');
      console.error('Erro ao atualizar entrega:', updateError);
      setLoading(false);
      return;
    }

    // Send WhatsApp with Fenix guide PDF and Google Review link when delivery is finalized
    if (pendingStatus === 'finalizado') {
      const phoneToUse = manualPhone.trim() || await getCustomerPhone(currentDelivery.customer_id);
      if (phoneToUse) {
        // Open WhatsApp directly on the company device to send to customer
        openWhatsAppDirect(phoneToUse, delivery.customer_name, delivery.order_number);

        try {
          await logWhatsAppMessage(
            id,
            currentDelivery.customer_id,
            phoneToUse,
            'GARANTIA',
            `Guia de Garantia Fenix e link Google enviados para ${delivery.customer_name}`,
            'sent'
          );
        } catch (err) {
          console.error('Erro ao registrar log do WhatsApp:', err);
        }
      }
    }

    setShowFeedbackModal(false);
    setPendingStatus(null);
    setMessage(`Entrega ${pendingStatus} e feedback salvo com sucesso.`);
    navigate('/entregas');
  };

  const skipFeedbackAndFinalize = async () => {
    if (!id || !delivery || !pendingStatus) return;
    setLoading(true);

    const { data: currentDelivery, error: currentDeliveryError } = await supabase
      .from('deliveries')
      .select('id, expedition_id, customer_id, status')
      .eq('id', id)
      .maybeSingle();

    if (currentDeliveryError || !currentDelivery) {
      setMessage('Erro ao buscar entrega antes de finalizar.');
      setLoading(false);
      return;
    }

    const { data: existingWarranty } = await supabase
      .from('warranties')
      .select('id')
      .eq('delivery_id', id)
      .maybeSingle();

    if (!existingWarranty) {
      const startDate = new Date().toISOString().slice(0, 10);
      const endDateObj = new Date();
      endDateObj.setMonth(endDateObj.getMonth() + 3);
      const endDate = endDateObj.toISOString().slice(0, 10);

      const { error: warrantyError } = await supabase.from('warranties').insert({
        delivery_id: id,
        expedition_id: currentDelivery.expedition_id,
        customer_id: currentDelivery.customer_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      });

      if (warrantyError) {
        if ((warrantyError as any).code !== '23505') {
          console.error('Erro ao criar garantia:', warrantyError);
        }
      }
    }

    const updatePayload: Record<string, any> = { status: pendingStatus };
    if (pendingStatus === 'finalizado') {
      updatePayload.finished_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('deliveries')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      setMessage('Erro ao atualizar status da entrega.');
      console.error('Erro ao atualizar entrega:', updateError);
      setLoading(false);
      return;
    }

    // Send WhatsApp with Fenix guide PDF and Google Review link when delivery is finalized
    if (pendingStatus === 'finalizado') {
      const phoneToUse = manualPhone.trim() || await getCustomerPhone(currentDelivery.customer_id);
      if (phoneToUse) {
        openWhatsAppDirect(phoneToUse, delivery.customer_name, delivery.order_number);
        try {
          await logWhatsAppMessage(
            id,
            currentDelivery.customer_id,
            phoneToUse,
            'GARANTIA',
            `Guia de Garantia Fenix e link Google enviados para ${delivery.customer_name}`,
            'sent'
          );
        } catch (err) {
          console.error('Erro ao registrar log do WhatsApp:', err);
        }
      }
    }


    setShowFeedbackModal(false);
    setPendingStatus(null);
    setMessage(`Entrega ${pendingStatus} finalizada (sem feedback).`);
    setLoading(false);
    navigate('/entregas');
  };

  const finalizeDelivery = async () => {
    if (!id || !delivery) return;
    // If there's a drawn signature, save it before finalizing
    try {
      const canvas = signatureRef.current;
      if (canvas && !canvas.isEmpty()) {
        await saveSignature();
      }
    } catch (e) {
      console.error('Erro ao salvar assinatura antes de finalizar:', e);
    }
    openFeedbackModal('finalizado');
  };

  const generatePdf = async () => {
    if (!delivery) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Comprovante de Entrega', 14, 20);
    doc.setFontSize(11);
    doc.text(`Pedido: ${delivery.order_number}`, 14, 34);
    doc.text(`NF: ${delivery.nf_number}`, 14, 42);
    doc.text(`Cliente: ${delivery.customer_name ?? '—'}`, 14, 50);
    doc.text(`Status: ${delivery.status}`, 14, 58);
    doc.text(`Chegada: ${delivery.arrival_at ? new Date(delivery.arrival_at).toLocaleString('pt-BR') : '—'}`, 14, 66);
    doc.text(`Assinatura: ${delivery.signer_name || '—'}`, 14, 74);
    doc.text(`Documento: ${delivery.signer_document || '—'}`, 14, 82);
    doc.text(`Cargo: ${delivery.signer_role || '—'}`, 14, 90);

    // Try to get signature image (from state, delivery object, or DB)
    let sigData = signatureImage || delivery.signature_data;
    if (!sigData) {
      try {
        const { data: sigRow } = await supabase
          .from('digital_signatures')
          .select('signature_data')
          .eq('delivery_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sigRow && (sigRow as any).signature_data) {
          sigData = (sigRow as any).signature_data;
        }
      } catch (e) {
        console.error('Erro ao buscar assinatura para PDF:', e);
      }
    }

    if (sigData) {
      try {
        // place image below signature info
        doc.addImage(sigData, 'PNG', 14, 98, 80, 40);
      } catch (e) {
        console.error('Erro ao adicionar imagem da assinatura ao PDF:', e);
        doc.text(`GPS: ${delivery.signature_gps || gps || '—'}`, 14, 98);
        doc.text(`IP: ${delivery.signature_ip || ip || '—'}`, 14, 106);
      }
    } else {
      doc.text(`GPS: ${delivery.signature_gps || gps || '—'}`, 14, 98);
      doc.text(`IP: ${delivery.signature_ip || ip || '—'}`, 14, 106);
    }

    doc.text('Fotos enviadas:', 14, 148);
    photos.slice(0, 6).forEach((photo, index) => {
      doc.text(`${index + 1}. ${photo.photo_type} — ${photo.public_url}`, 14, 156 + index * 8);
    });
    doc.save(`comprovante_entrega_${delivery.order_number || id}.pdf`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando entrega...</div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-rose-700">Entrega não encontrada</h2>
          <p className="mt-3 text-sm text-slate-600">O registro solicitado não está disponível ou você não tem permissão para acessá-lo.</p>
          <button
            onClick={() => navigate('/entregas')}
            className="mt-6 px-5 py-3 bg-blue-600 text-white rounded-2xl font-semibold"
          >
            Voltar para Entregas
          </button>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return <div className="min-h-screen flex items-center justify-center">Carregando entrega...</div>;
  }

  const uploadedTypes = new Set(photos.map((photo) => photo.photo_type));

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-10 px-4 -mx-4 lg:mx-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors border border-slate-200 shadow-sm">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Entrega #{delivery.order_number}</h2>
          <p className="text-sm text-slate-500 font-medium">Cliente: {delivery.customer_name ?? '—'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={20} className="text-blue-600" /> Chegada e Checklist</h3>
                <p className="text-sm text-slate-500">Registre a chegada e confirme o checklist antes de seguir.</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{delivery.status.replaceAll('_', ' ')}</span>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">Chegada</label>
                  <input type="datetime-local" value={delivery.arrival_at ? delivery.arrival_at.slice(0, 16) : ''} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" />
                  {!isViewMode && (
                    <button type="button" onClick={recordArrival} className="mt-2 w-full bg-blue-600 text-white rounded-2xl py-2 text-sm font-semibold">Registrar Chegada</button>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">GPS</label>
                  <input type="text" value={gps} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">IP</label>
                  <input type="text" value={ip} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Camera size={20} className="text-blue-600" /> Fotos obrigatórias</h3>
                <p className="text-sm text-slate-500">Envie todas as fotos obrigatórias com carimbo de entrega.</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{photos.length} enviadas</span>
            </div>
            <div>
              {isViewMode ? (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {requiredPhotos.map((item) => {
                    const photo = photos.find((p) => p.photo_type === item.key);
                    return (
                      <div
                        key={item.key}
                        className="group aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2"
                      >
                        {photo ? (
                          <div className="relative h-full w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
                            <img src={photo.public_url} alt={item.label} className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-2 text-[10px] font-bold uppercase text-white">
                              {item.label}
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                            <Camera size={24} className="text-slate-400" />
                            <span className="text-[11px] font-bold uppercase text-center px-2">{item.label}</span>
                            <span className="text-[10px] text-slate-400">Sem foto</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {requiredPhotos.map((item) => {
                      const photo = photos.find((p) => p.photo_type === item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handlePhotoTypeSelect(item.key)}
                          className="group aspect-square overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50"
                        >
                          {photo ? (
                            <div className="relative h-full w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
                              <img src={photo.public_url} alt={item.label} className="h-full w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-2 text-[10px] font-bold uppercase text-white">
                                {item.label}
                              </div>
                              <div className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
                                Recarregar
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                              <Camera size={24} className="text-slate-400 group-hover:text-blue-500" />
                              <span className="text-[11px] font-bold uppercase text-center px-2">{item.label}</span>
                              <span className="text-[10px] text-slate-400">Clique para enviar</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    ref={(instance) => {
                      if (fileInputRef) fileInputRef.current = instance;
                    }}
                    type="file"
                    accept={currentUploadType === 'photo' ? 'image/*' : 'video/*'}
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  {uploading && uploading !== 'video' && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>Comprimindo e enviando...</span>
                        <span>{photoUploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${photoUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {photos.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {photos.map((photo) => (
                  <a key={photo.id} href={photo.public_url} target="_blank" rel="noreferrer" className="block rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src={photo.public_url} alt={photo.photo_type} className="h-40 w-full object-cover" />
                    <div className="p-3 text-xs text-slate-500">{photo.photo_type} • {new Date(photo.captured_at).toLocaleString('pt-BR')}</div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Video size={20} className="text-green-600" /> Vídeos da Entrega</h3>
                <p className="text-sm text-slate-500">Registre vídeos adicionais do processo de entrega.</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{videos.length} enviados</span>
            </div>
            <div>
              {videos.length > 0 && (
                <div className="grid gap-3 mb-6 sm:grid-cols-2">
                  {videos.map((video) => (
                    <a key={video.id} href={video.public_url} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 p-4 relative">
                      <div className="h-32 flex items-center justify-center">
                        <Video size={48} className="text-green-500" />
                      </div>
                      <div className="p-3 text-xs text-slate-300">Vídeo • {new Date(video.captured_at).toLocaleString('pt-BR')}</div>
                    </a>
                  ))}
                </div>
              )}
              {!isViewMode && (
                <>
                  <button
                    type="button"
                    onClick={handleVideoUploadClick}
                    disabled={uploading === 'video'}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                  >
                    <Video size={20} />
                    {uploading === 'video' ? 'Enviando vídeo...' : 'Enviar vídeo'}
                  </button>
                  {uploading === 'video' && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>Enviando vídeo...</span>
                        <span>{videoUploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Signature size={20} className="text-blue-600" /> Assinatura do cliente</h3>
                <p className="text-sm text-slate-500">Preencha os dados do responsável e capture a assinatura.</p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-500">{delivery.signed_at ? 'Assinado' : 'Pendente'}</div>
            </div>
            {isViewMode ? (
              <div className="space-y-4 text-sm text-slate-600">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Nome</p>
                    <p className="mt-2 text-slate-700">{delivery.signer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Documento</p>
                    <p className="mt-2 text-slate-700">{delivery.signer_document || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Cargo</p>
                    <p className="mt-2 text-slate-700">{delivery.signer_role || '—'}</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4 text-slate-600">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Data de assinatura</p>
                  <p className="mt-2 text-slate-700">{delivery.signed_at ? new Date(delivery.signed_at).toLocaleString('pt-BR') : 'Nenhuma assinatura registrada'}</p>
                </div>
                <div className="rounded-3xl bg-white border border-slate-200 p-4 mt-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Desenho da Assinatura</p>
                  {signatureImage ? (
                    <div className="mt-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[140px]">
                      <img src={signatureImage} alt="Assinatura do cliente" className="max-h-56 w-auto object-contain rounded-md" />
                    </div>
                  ) : (
                    <div className="mt-2 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Nenhum desenho de assinatura visual registrado para esta entrega.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dados do responsável */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs uppercase text-slate-500">Nome do responsável</span>
                    <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="Nome completo" />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase text-slate-500">Documento</span>
                    <input value={signatureDocument} onChange={(e) => setSignatureDocument(e.target.value)} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="CPF/CNPJ" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs uppercase text-slate-500">Cargo</span>
                    <input value={signatureRole} onChange={(e) => setSignatureRole(e.target.value)} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="Função do responsável" />
                  </label>
                </div>

                {/* Canvas de assinatura */}
                <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-slate-500">Assine abaixo</span>
                    <button onClick={clearSignature} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Limpar</button>
                  </div>
                  <div className="h-64">
                    <SignatureCanvas ref={signatureRef} penColor="black" canvasProps={{ className: 'w-full h-full' }} />
                  </div>
                </div>

                {/* Botão de registrar */}
                <button
                  type="button"
                  onClick={saveSignature}
                  className="w-full bg-blue-600 text-white rounded-2xl py-3 font-semibold hover:bg-blue-700 transition-colors"
                >
                  Registrar Assinatura
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Resumo rápido</h3>
                <p className="text-sm text-slate-500">Informações de status, QR e comprovantes.</p>
              </div>
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Pedido</span><strong>{delivery.order_number}</strong></div>
              <div className="flex items-center justify-between"><span>NF</span><strong>{delivery.nf_number}</strong></div>
              <div className="flex items-center justify-between"><span>Cliente</span><strong>{delivery.customer_name ?? '—'}</strong></div>
              <div className="flex items-center justify-between"><span>Fotos</span><strong>{photos.length}</strong></div>
              <div className="flex items-center justify-between"><span>GPS</span><strong>{gps || '—'}</strong></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><QrCode size={18} /> QR Code da entrega</h3>
                <p className="text-sm text-slate-500">Escaneie para visualizar comprovante, fotos e garantias.</p>
              </div>
            </div>
            <div className="mx-auto w-40 h-40 bg-slate-100 rounded-3xl flex items-center justify-center">
              {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="rounded-3xl" /> : <div className="text-xs text-slate-500">Gerando QR...</div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <button
              type="button"
              onClick={() => {
                const phoneToUse = manualPhone.trim();
                if (!phoneToUse.replace(/\D/g, '')) {
                  setMessage('Informe o WhatsApp do cliente para enviar a mensagem.');
                  setShowFeedbackModal(true);
                  return;
                }
                openWhatsAppDirect(phoneToUse, delivery.customer_name, delivery.order_number);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <MessageSquare size={18} /> Enviar Guia + Avaliação (WhatsApp)
            </button>
            <button onClick={generatePdf} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2">
              <Download size={18} /> Gerar PDF de Entrega
            </button>
            {!isViewMode && (
              <button onClick={finalizeDelivery} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2">
                <FileText size={18} /> Finalizar e Solicitar Feedback
              </button>
            )}
            {message && <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</div>}
          </div>
        </aside>
      </div>
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200/60 overflow-auto">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Feedback</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Avaliação da entrega</h3>
                <p className="mt-1 text-sm text-slate-500">Peça ao cliente para avaliar o serviço antes de finalizar.</p>
              </div>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: 'Entrega', value: feedbackDeliveryRating, setter: setFeedbackDeliveryRating, description: 'Recebimento e apresentação' },
                  { label: 'Instalação', value: feedbackInstallationRating, setter: setFeedbackInstallationRating, description: 'Montagem e funcionamento' },
                  { label: 'Serviço', value: feedbackServiceRating, setter: setFeedbackServiceRating, description: 'Atendimento e suporte' },
                  { label: 'Equipamento', value: feedbackEquipmentRating, setter: setFeedbackEquipmentRating, description: 'Estado do equipamento' },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.value}/5</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => item.setter(star)}
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition duration-150 ${star <= item.value ? 'bg-amber-300 text-slate-900 shadow-sm shadow-amber-300/20' : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                          <Star size={20} className={star <= item.value ? 'fill-current text-amber-600' : 'stroke-current text-slate-400'} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Comentários</p>
                    <p className="mt-1 text-xs text-slate-500">Escreva uma observação rápida sobre a entrega.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-500">Opcional</span>
                </div>
                <textarea
                  value={feedbackComments}
                  onChange={(event) => setFeedbackComments(event.target.value)}
                  rows={5}
                  className="mt-4 min-h-[150px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Escreva o comentário do cliente aqui..."
                />
              </div>

              {/* WhatsApp do cliente (1 clique - Guia + Google Review) */}
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <MessageSquare size={18} className="text-emerald-600" />
                      WhatsApp do cliente (Envio do Guia + Avaliação Google)
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Ao finalizar a entrega no celular da empresa, o WhatsApp abrirá automaticamente para enviar o <strong>Guia de Garantia em PDF</strong> e o <strong>Link do Google</strong> direto para o cliente.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs uppercase tracking-[0.18em] font-bold w-fit shadow-sm">
                    Envio WhatsApp
                  </span>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="WhatsApp do cliente: (11) 99999-9999"
                    className="flex-1 rounded-[20px] border border-emerald-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualPhone.replace(/\D/g, '')) {
                        alert('Por favor, informe o número de WhatsApp do cliente com DDD.');
                        return;
                      }
                      openWhatsAppDirect(manualPhone, delivery.customer_name, delivery.order_number);
                    }}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[20px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    <MessageSquare size={16} /> Abrir WhatsApp Agora
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-emerald-800">
                  ✓ O envio é feito diretamente pelo WhatsApp do celular da sua empresa para o número informado acima.
                </p>
              </div>


              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="inline-flex min-w-[160px] items-center justify-center rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={skipFeedbackAndFinalize}
                  disabled={loading}
                  className="inline-flex min-w-[200px] items-center justify-center rounded-3xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  {loading ? 'Processando...' : 'Pular feedback e finalizar'}
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={loading}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Salvando...' : 'Salvar Feedback e Finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
