
import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Camera,
  Upload,
  X,
  Info,
  ChevronRight,
  CheckCircle,
  Truck,
  Video,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { uploadImageToCloudinary, uploadVideoToCloudinary } from '../../lib/cloudinary';

type Product = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  serial: string;
};

type Volume = {
  id: string;
  number: number;
  desc: string;
  qty: number;
  weight: number;
};

type Expedition = {
  id: string;
  order_number: string;
  nf_number: string;
  client_name: string;
  client_email?: string | null;
  address: string;
  carrier: string;
  freight_type: string;
  responsible: string | null;
  observations: string | null;
  status: string;
  date: string;
  created_at: string;
  updated_at: string;
  products: Product[];
  metadata: {
    volumes?: Volume[];
    photos?: Array<{ label?: string; photo_type?: string; public_url?: string; public_id?: string }>;
  };
  responsible_user_id: string | null;
};

type ExpeditionForm = {
  date: string;
  nf: string;
  order: string;
  client: string;
  client_email: string;
  address: string;
  carrier: string;
  freight: 'CIF' | 'FOB' | 'CIF/FOB' | 'OUTROS';
  responsible: string;
  notes: string;
  driver_id: string;
  status: 'pendente' | 'em_transito' | 'concluido' | 'cancelado';
  customer_contact_done: boolean;
  customer_contact_notes: string;
  assembly_technician: string;
};

type ExpeditionPhoto = {
  id: string;
  label: string;
  publicUrl: string;
  public_id: string;
  photo_type: string;
};

type ExpeditionVideo = {
  id: string;
  label: string;
  publicUrl: string;
  public_id: string;
};

export const NewExpedition = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [isLoadingExpedition, setIsLoadingExpedition] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<ExpeditionForm>({
    date: new Date().toISOString().split('T')[0],
    nf: '',
    order: '',
    client: '',
    client_email: '',
    address: '',
    carrier: '',
    freight: 'CIF',
    responsible: '',
    notes: '',
    driver_id: '',
    status: 'em_transito',
    customer_contact_done: false,
    customer_contact_notes: '',
    assembly_technician: '',
  });

  const [products, setProducts] = useState<Product[]>([
    { id: '1', sku: '', name: '', qty: 1, serial: '' },
  ]);

  const [volumes, setVolumes] = useState<Volume[]>([
    { id: '1', number: 1, desc: '', qty: 1, weight: 0 },
  ]);

  const [photos, setPhotos] = useState<ExpeditionPhoto[]>([]);
  const [videos, setVideos] = useState<ExpeditionVideo[]>([]);
  const [photoTypeToUpload, setPhotoTypeToUpload] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [currentUploadType, setCurrentUploadType] = useState<'photo' | 'video'>('photo');
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState('');

  const steps = [
    { title: 'Dados da Expedição', description: 'Preencha pedido, cliente, endereço e frete.' },
    { title: 'Produtos & Volumes', description: 'Liste equipamentos e embalagens de carga.' },
    { title: 'Fotos de Expedição', description: 'Registre o carregamento antes da saída.' },
    { title: 'Motorista & Envio', description: 'Atribua o motorista e finalize o envio.' },
  ];

  // Load drivers on mount
  React.useEffect(() => {
    const loadDriversList = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'motorista');
      if (data) {
        setDrivers(data);
      }
      setLoadingDrivers(false);
    };
    loadDriversList();
  }, []);

  React.useEffect(() => {
    if (!id) return;

    const loadExpedition = async () => {
      setIsLoadingExpedition(true);
      setLoadError('');

      const { data, error } = await supabase
        .from('expeditions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Erro ao carregar expedição para edição:', error?.message || 'Nenhum dado encontrado');
        setLoadError('Não foi possível carregar a expedição para edição.');
        setIsLoadingExpedition(false);
        return;
      }

const normalizeStatus = (inputStatus: string) => {
          if (inputStatus === 'entregue' || inputStatus === 'finalizado') return 'concluido';
          return inputStatus as ExpeditionForm['status'];
        };

        setForm({
          date: data.date ? new Date(data.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          nf: data.nf_number,
          order: data.order_number,
          client: data.client_name,
          client_email: data.client_email || '',
          address: data.address,
          carrier: data.carrier,
          freight: data.freight_type as ExpeditionForm['freight'],
          responsible: data.responsible || '',
          notes: data.observations || '',
          driver_id: data.responsible_user_id || '',
          status: normalizeStatus(data.status),
          customer_contact_done: data.customer_contact_done || false,
          customer_contact_notes: data.customer_contact_notes || '',
          assembly_technician: data.assembly_technician || '',
      });

      setProducts(Array.isArray(data.products) && data.products.length > 0 ? data.products : [{ id: '1', sku: '', name: '', qty: 1, serial: '' }]);

      const metadata = data.metadata || {};
      const loadedVolumes = Array.isArray(metadata.volumes) && metadata.volumes.length > 0
        ? metadata.volumes
        : [{ id: '1', number: 1, desc: '', qty: 1, weight: 0 }];
      setVolumes(
        loadedVolumes.map((volume, index) => ({
          id: volume.id ?? `volume-${index}`,
          number: volume.number,
          desc: volume.desc,
          qty: volume.qty,
          weight: volume.weight,
        }))
      );

      setPhotos(
        Array.isArray(metadata.photos)
          ? metadata.photos.map((photo, index) => ({
              id: photo.public_id ? `existing-${photo.public_id}` : `photo-${index}`,
              label: photo.label || '',
              photo_type: photo.photo_type || '',
              publicUrl: photo.public_url || '',
              public_id: photo.public_id || '',
            }))
          : []
      );

      setVideos(
        Array.isArray(metadata.videos)
          ? metadata.videos.map((video, index) => ({
              id: video.public_id ? `existing-${video.public_id}` : `video-${index}`,
              label: video.label || 'Vídeo',
              publicUrl: video.public_url || '',
              public_id: video.public_id || '',
            }))
          : []
      );

      setIsLoadingExpedition(false);
    };

    loadExpedition();
  }, [id]);

  const addProduct = () => {
    setProducts((current) => [
      ...current,
      { id: Date.now().toString(), sku: '', name: '', qty: 1, serial: '' },
    ]);
  };

  const removeProduct = (id: string) => {
    setProducts((current) => current.filter((product) => product.id !== id));
  };

  const updateProduct = (id: string, field: keyof Product, value: string | number) => {
    setProducts((current) =>
      current.map((product) => (product.id === id ? { ...product, [field]: value } : product))
    );
  };

  const addVolume = () => {
    setVolumes((current) => [
      ...current,
      { id: Date.now().toString(), number: current.length + 1, desc: '', qty: 1, weight: 0 },
    ]);
  };

  const removeVolume = (id: string) => {
    setVolumes((current) => current.filter((volume) => volume.id !== id));
  };

  const removeVideo = (id: string) => {
    setVideos((current) => current.filter((video) => video.id !== id));
  };

  const updateVolume = (id: string, field: keyof Volume, value: string | number) => {
    setVolumes((current) =>
      current.map((volume) => (volume.id === id ? { ...volume, [field]: value } : volume))
    );
  };

  const handleInputChange = (field: keyof ExpeditionForm, value: string | boolean) => {
    const finalValue = typeof value === 'boolean' ? value : value;
    setForm((current) => ({ ...current, [field]: finalValue }));
  };

  const findCustomerIdByName = async (clientName: string) => {
    const search = clientName.trim();
    if (!search) return null;

    const { data: matchedCustomers, error: matchError } = await supabase
      .from('customers')
      .select('id')
      .or(`name.ilike.%${search}%,company_name.ilike.%${search}%`)
      .limit(1);

    if (matchError || !matchedCustomers || matchedCustomers.length === 0) {
      return null;
    }

    return matchedCustomers[0].id;
  };

  const handlePhotoTypeSelect = (type: string) => {
    setPhotoTypeToUpload(type);
    setCurrentUploadType('photo');
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.capture = 'environment';
      fileInputRef.current.multiple = true;
      fileInputRef.current.click();
    }
  };

  const handleVideoUpload = () => {
    setCurrentUploadType('video');
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'video/*';
      fileInputRef.current.capture = 'camcorder';
      fileInputRef.current.multiple = false;
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    if (currentUploadType === 'photo') {
      if (photos.length >= 6) {
        setUploadMessage('Limite de 6 fotos atingido.');
        return;
      }

      setUploadingPhoto(true);
      setPhotoUploadProgress(0);
      setUploadMessage('Comprimindo e enviando foto(s)...');
      const selectedType = photoTypeToUpload || 'expedition';
      const filesToUpload = Array.from(files).slice(0, 6 - photos.length);
      let completedCount = 0;

      try {
        // Upload em paralelo de todas as fotos simultaneamente
        const results = await Promise.all(
          filesToUpload.map((file) =>
            uploadImageToCloudinary(file, `expeditions/${new Date().toISOString().slice(0, 10)}`, {
              onProgress: (percent) => {
                // Progresso médio de todos os uploads em andamento
                const overallPercent = Math.round(
                  ((completedCount * 100 + percent) / filesToUpload.length)
                );
                setPhotoUploadProgress(overallPercent);
              },
            }).then((result) => {
              completedCount += 1;
              return result;
            })
          )
        );

        const newPhotos: ExpeditionPhoto[] = results.map((uploadResult) => ({
          id: crypto.randomUUID(),
          label: selectedType,
          photo_type: selectedType.toLowerCase().replace(/\s+/g, '_'),
          publicUrl: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        }));

        setPhotos((current) => [...current, ...newPhotos]);
        setPhotoUploadProgress(100);
        setUploadMessage(`${newPhotos.length} foto(s) enviadas com sucesso.`);
      } catch (error: any) {
        console.error('Falha ao enviar foto:', error);
        setUploadMessage(error?.message || 'Falha ao enviar foto para o Cloudinary.');
      } finally {
        setUploadingPhoto(false);
        setPhotoTypeToUpload('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } else if (currentUploadType === 'video') {
      if (videos.length >= 5) {
        setUploadMessage('Limite de 5 vídeos atingido.');
        return;
      }

      setUploadingVideo(true);
      setVideoUploadProgress(0);
      setUploadMessage('Enviando vídeo...');

      try {
        const filesToUpload = Array.from(files).slice(0, 5 - videos.length);
        const results = await Promise.all(
          filesToUpload.map((file) =>
            uploadVideoToCloudinary(file, `expeditions/${new Date().toISOString().slice(0, 10)}`, {
              onProgress: (percent) => setVideoUploadProgress(percent),
            })
          )
        );

        const newVideos: ExpeditionVideo[] = results.map((uploadResult) => ({
          id: crypto.randomUUID(),
          label: 'Vídeo',
          publicUrl: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        }));

        setVideos((current) => [...current, ...newVideos]);
        setVideoUploadProgress(100);
        setUploadMessage(`${newVideos.length} vídeo(s) enviado(s) com sucesso.`);
      } catch (error: any) {
        console.error('Falha ao enviar vídeo:', error);
        setUploadMessage(error?.message || 'Falha ao enviar vídeo para o Cloudinary.');
      } finally {
        setUploadingVideo(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) {
      setStepError('Revise os campos obrigatórios antes de avançar.');
      return;
    }
    setStepError('');
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  };

  const handlePreviousStep = () => {
    setStepError('');
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const handleSave = async () => {
    if (currentStep < steps.length) {
      handleNextStep();
      return;
    }

    if (!validateStep(currentStep)) {
      setStepError('Revise os campos obrigatórios antes de salvar.');
      return;
    }

    setSaving(true);
    setStepError('');

    const dateValue = form.date ? new Date(form.date).toISOString() : new Date().toISOString();

    const normalizeStatus = (inputStatus: string) => {
      if (inputStatus === 'entregue' || inputStatus === 'finalizado') return 'concluido';
      return inputStatus as ExpeditionForm['status'];
    };

    const payload = {
      order_number: form.order,
      nf_number: form.nf,
      client_name: form.client,
      client_email: form.client_email || null,
      address: form.address,
      carrier: form.carrier,
      freight_type: form.freight,
      responsible: form.responsible || null,
      observations: form.notes || null,
      status: normalizeStatus(form.status),
      date: dateValue,
      responsible_user_id: form.driver_id || null,
      customer_contact_done: form.customer_contact_done,
      customer_contact_notes: form.customer_contact_notes || null,
      assembly_technician: form.assembly_technician || null,
      products: products.map(({ id, sku, name, qty, serial }) => ({ id, sku, name, qty, serial })),
      metadata: {
        volumes,
        photos: photos.map((photo) => ({
          label: photo.label,
          photo_type: photo.photo_type,
          public_url: photo.publicUrl,
          public_id: photo.public_id,
        })),
        videos: videos.map((video) => ({
          label: video.label,
          public_url: video.publicUrl,
          public_id: video.public_id,
        })),
      },
    };

    let expeditionId = id;

    const customerId = await findCustomerIdByName(payload.client_name);
    const expeditionPayload = {
      ...payload,
      customer_id: customerId,
    };

    if (isEditing) {
      const { error } = await supabase
        .from('expeditions')
        .update(expeditionPayload)
        .eq('id', id)
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao atualizar expedição:', error?.message || 'Resposta inesperada do servidor');
        setSaving(false);
        setStepError('Falha ao salvar as alterações. Verifique os dados e tente novamente.');
        return;
      }
    } else {
      const { data: expeditionData, error } = await supabase
        .from('expeditions')
        .insert([expeditionPayload])
        .select('id')
        .single();

      if (error || !expeditionData?.id) {
        console.error('Erro ao criar expedição:', error?.message || 'Resposta inesperada do servidor');
        setSaving(false);
        setStepError('Falha ao salvar expedição. Verifique os dados e tente novamente.');
        return;
      }

      expeditionId = expeditionData.id;

      // Criar registro de entrega associado à expedição recém-criada
      try {
        const customerId = await findCustomerIdByName(payload.client_name);

        const deliveryPayload = {
          expedition_id: expeditionData.id,
          order_number: payload.order_number,
          nf_number: payload.nf_number,
          status: payload.status || 'em_transito',
          driver_user_id: payload.responsible_user_id || null,
          customer_id: customerId,
        };

        const { data: deliveryData, error: deliveryError } = await supabase
          .from('deliveries')
          .insert([deliveryPayload])
          .select('id')
          .single();

        if (deliveryError) {
          console.error('Erro ao criar entrega associada:', deliveryError.message);
        } else {
          console.log('Entrega criada com id:', deliveryData?.id);
        }
      } catch (e) {
        console.error('Erro inesperado ao criar entrega associada:', e);
      }
    }

    if (!isEditing && photos.length > 0 && expeditionId) {
      const photoPayload = photos.map((photo) => ({
        expedition_id: expeditionId,
        photo_type: photo.photo_type,
        storage_path: photo.public_id,
        public_url: photo.publicUrl,
      }));

      const { error: photoError } = await supabase.from('expedition_photos').insert(photoPayload);
      if (photoError) {
        console.error('Erro ao salvar fotos da expedição:', photoError.message);
        setSaving(false);
        setStepError('Expedição criada, mas falha ao salvar fotos. Tente novamente.');
        return;
      }
    }

    setSaving(false);
    navigate('/expedicoes');
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          form.client.trim() &&
          form.nf.trim() &&
          form.order.trim() &&
          form.address.trim() &&
          form.carrier.trim()
        );
      case 2:
        return products.length > 0 && volumes.length > 0;
      case 3:
        return photos.length > 0;
      case 4:
        return !!form.driver_id;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Expedição' : 'Nova Expedição'}</h2>
            <p className="text-slate-500">{isEditing ? 'Atualize os detalhes desta expedição.' : steps[currentStep - 1].description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-200"
          >
            <Save size={18} />
            {saving ? 'Salvando...' : currentStep < steps.length ? 'Próximo passo' : isEditing ? 'Salvar alterações' : 'Salvar expedição'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setCurrentStep(index + 1)}
                  className={`rounded-3xl border px-4 py-3 text-left transition-all ${
                    currentStep === index + 1
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>{index + 1}</span>
                    <span>{step.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {currentStep === 1 && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Info size={20} className="text-blue-600" />
                Informações da Expedição
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Data da Expedição</label>
                  <input
                    value={form.date}
                    onChange={(event) => handleInputChange('date', event.target.value)}
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Número da Nota Fiscal</label>
                  <input
                    value={form.nf}
                    onChange={(event) => handleInputChange('nf', event.target.value)}
                    type="text"
                    placeholder="000.000.000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Número do Pedido</label>
                  <input
                    value={form.order}
                    onChange={(event) => handleInputChange('order', event.target.value)}
                    type="text"
                    placeholder="PED-12345"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cliente</label>
                  <input
                    value={form.client}
                    onChange={(event) => handleInputChange('client', event.target.value)}
                    type="text"
                    placeholder="Nome da Academia ou Cliente"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">E-mail do Cliente</label>
                  <input
                    value={form.client_email}
                    onChange={(event) => handleInputChange('client_email', event.target.value)}
                    type="email"
                    placeholder="email@cliente.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Endereço de Entrega</label>
                  <input
                    value={form.address}
                    onChange={(event) => handleInputChange('address', event.target.value)}
                    type="text"
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Transportadora</label>
                  <input
                    value={form.carrier}
                    onChange={(event) => handleInputChange('carrier', event.target.value)}
                    type="text"
                    placeholder="TransAcademia, LogFit Brasil..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Frete</label>
                  <div className="flex gap-4 p-1 bg-slate-100 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => handleInputChange('freight', 'CIF')}
                      className={`px-4 py-1.5 text-sm font-bold rounded-md ${form.freight === 'CIF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                    >
                      CIF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('freight', 'FOB')}
                      className={`px-4 py-1.5 text-sm font-bold rounded-md ${form.freight === 'FOB' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                    >
                      FOB
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Expedidor Responsável</label>
                  <input
                    value={form.responsible}
                    onChange={(event) => handleInputChange('responsible', event.target.value)}
                    type="text"
                    placeholder="Nome do funcionário"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Observações</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => handleInputChange('notes', event.target.value)}
                    rows={3}
                    placeholder="Instruções especiais de entrega..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.customer_contact_done}
                      onChange={(event) => handleInputChange('customer_contact_done', event.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-700">Contato com cliente realizado</span>
                  </label>
                  <p className="text-xs text-slate-500 ml-7">Marque se já foi conversado com o cliente sobre a entrega</p>
                </div>
                {form.customer_contact_done && (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Notas do Contato</label>
                    <textarea
                      value={form.customer_contact_notes}
                      onChange={(event) => handleInputChange('customer_contact_notes', event.target.value)}
                      rows={2}
                      placeholder="Resumo da conversa com o cliente..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                )}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Montador / Técnico de Instalação</label>
                  <input
                    value={form.assembly_technician}
                    onChange={(event) => handleInputChange('assembly_technician', event.target.value)}
                    type="text"
                    placeholder="Nome de quem montou as máquinas"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <>
              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      <Plus size={18} />
                    </div>
                    Equipamentos
                  </h3>
                  <button
                    type="button"
                    onClick={addProduct}
                    className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Adicionar Equipamento
                  </button>
                </div>
                <div className="space-y-4">
                  {products.map((product, idx) => (
                    <div key={product.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">SKU</label>
                        <input
                          value={product.sku}
                          onChange={(event) => updateProduct(product.id, 'sku', event.target.value)}
                          type="text"
                          placeholder="EST-001"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome do Equipamento</label>
                        <input
                          value={product.name}
                          onChange={(event) => updateProduct(product.id, 'name', event.target.value)}
                          type="text"
                          placeholder="Esteira Profissional X1"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Qtd</label>
                        <input
                          value={product.qty}
                          onChange={(event) => updateProduct(product.id, 'qty', Number(event.target.value))}
                          type="number"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Série</label>
                        <input
                          value={product.serial}
                          onChange={(event) => updateProduct(product.id, 'serial', event.target.value)}
                          type="text"
                          placeholder="SN-2024-XXXX"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      <Truck size={18} />
                    </div>
                    Volumes de Acessórios
                  </h3>
                  <button
                    type="button"
                    onClick={addVolume}
                    className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Adicionar Volume
                  </button>
                </div>
                <div className="space-y-4">
                  {volumes.map((volume) => (
                    <div key={volume.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Vol</label>
                        <div className="w-full bg-slate-200 rounded-lg p-2 text-sm font-bold text-center text-slate-700">{volume.number}</div>
                      </div>
                      <div className="md:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição</label>
                        <input
                          value={volume.desc}
                          onChange={(event) => updateVolume(volume.id, 'desc', event.target.value)}
                          type="text"
                          placeholder="Kit de Parafusos / Painéis"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Qtd</label>
                        <input
                          value={volume.qty}
                          onChange={(event) => updateVolume(volume.id, 'qty', Number(event.target.value))}
                          type="number"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Peso (kg)</label>
                        <input
                          value={volume.weight}
                          onChange={(event) => updateVolume(volume.id, 'weight', Number(event.target.value))}
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => removeVolume(volume.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full flex justify-center border border-transparent hover:border-red-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {currentStep === 3 && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Camera size={20} className="text-blue-600" />
                    Fotos de Expedição
                  </h3>
                  <p className="text-sm text-slate-500">Capture o carregamento completo para o registro inicial.</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{photos.length}/6</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {['Estética', 'Placa ID', 'Carga Montada', 'Equipamentos', 'Acessórios', 'Caminhão', 'Nota Fiscal'].map((label, idx) => {
                  const cardPhoto = photos.find((photo) => photo.label === label);
                  const count = photos.filter((photo) => photo.label === label).length;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePhotoTypeSelect(label)}
                      className="group aspect-square overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50"
                    >
                      {cardPhoto ? (
                        <div className="relative h-full w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
                          <img
                            src={cardPhoto.publicUrl}
                            alt={label}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-2 text-[10px] font-bold uppercase text-white">
                            {label}
                          </div>
                          {count > 1 && (
                            <div className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
                              {count}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                          <Camera size={20} className="text-slate-400 group-hover:text-blue-500" />
                          <span className="text-[10px] font-bold uppercase text-center px-2">{label}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {photos.length === 0 ? (
                  <div className="text-xs text-slate-500">Nenhuma foto carregada ainda.</div>
                ) : (
                  photos.map((photo, index) => (
                    <div key={photo.id} className="flex flex-col gap-3 border border-slate-100 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <img src={photo.publicUrl} alt={photo.label} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">{photo.label}</p>
                          <p className="text-[10px] text-slate-400">{photo.photo_type}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <input
                ref={(instance) => {
                  if (fileInputRef) {
                    fileInputRef.current = instance;
                  }
                }}
                type="file"
                accept={currentUploadType === 'photo' ? 'image/*' : 'video/*'}
                capture={currentUploadType === 'photo' ? 'environment' : ('camcorder' as any)}
                multiple={currentUploadType === 'photo'}
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={() => handlePhotoTypeSelect('Outros')}
                disabled={uploadingPhoto}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-800 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-900 disabled:opacity-60 transition-all"
              >
                <Upload size={18} />
                {uploadingPhoto ? 'Enviando...' : 'Adicionar foto'}
              </button>

              {uploadingPhoto && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>{uploadMessage}</span>
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
              {!uploadingPhoto && uploadMessage && (
                <p className="mt-3 text-sm text-slate-600">{uploadMessage}</p>
              )}
            </section>
          )}

          {currentStep === 3 && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Video size={20} className="text-green-600" />
                    Vídeos da Expedição
                  </h3>
                  <p className="text-sm text-slate-500">Registre vídeos do carregamento e transporte.</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{videos.length}/5</span>
              </div>

              <div className="space-y-4 mb-6">
                {videos.length === 0 ? (
                  <div className="text-xs text-slate-500 p-4 bg-slate-50 rounded-lg text-center">Nenhum vídeo carregado ainda.</div>
                ) : (
                  videos.map((video, index) => (
                    <div key={video.id} className="flex flex-col gap-3 border border-slate-100 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-slate-900 flex items-center justify-center text-white">
                          <Video size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-700">{video.label}</p>
                          <p className="text-[10px] text-slate-400 break-all">{video.publicUrl}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVideo(video.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={handleVideoUpload}
                disabled={uploadingVideo}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-60 transition-all"
              >
                <Video size={18} />
                {uploadingVideo ? 'Enviando...' : 'Adicionar vídeo'}
              </button>

              {uploadingVideo && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>{uploadMessage}</span>
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
              {!uploadingVideo && uploadMessage && (
                <p className="mt-3 text-sm text-slate-600">{uploadMessage}</p>
              )}
            </section>
          )}

          {currentStep === 4 && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <CheckCircle size={20} className="text-blue-600" />
                Motorista e Envio
              </h3>
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Motorista</label>
                  <select
                    value={form.driver_id}
                    onChange={(event) => handleInputChange('driver_id', event.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um motorista</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Status da Expedição</label>
                  <select
                    value={form.status}
                    onChange={(event) => handleInputChange('status', event.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_transito">Em Trânsito</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {stepError && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {stepError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row justify-between">
            <button
              type="button"
              onClick={handlePreviousStep}
              disabled={currentStep === 1}
              className="w-full sm:w-auto px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-60 transition-all"
            >
              <Save size={18} />
              {saving ? 'Salvando...' : currentStep < steps.length ? 'Próximo passo' : 'Salvar expedição'}
            </button>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-24">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Resumo</p>
                <h3 className="mt-2 text-xl font-bold text-slate-800">
                  {currentStep < steps.length ? 'Preparando expedição' : 'Última revisão'}
                </h3>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Etapa {currentStep} / {steps.length}
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold text-slate-800">Status</span>
                <span className="text-right text-blue-600">{form.status.replaceAll('_', ' ')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold text-slate-800">Motorista</span>
                <span className="text-right text-slate-700">
                  {form.driver_id ? drivers.find((driver) => driver.id === form.driver_id)?.name ?? 'Selecionado' : 'Não atribuído'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold text-slate-800">Fotos</span>
                <span className="text-right text-slate-700">{photos.length} / 6</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold text-slate-800">Volumes</span>
                <span className="text-right text-slate-700">{volumes.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold text-slate-800">Produtos</span>
                <span className="text-right text-slate-700">{products.length}</span>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400 mb-4">Detalhes rápidos</h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold">Pedido</span>
                <span className="text-right text-slate-600">{form.order || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold">Nota Fiscal</span>
                <span className="text-right text-slate-600">{form.nf || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold">Cliente</span>
                <span className="text-right text-slate-600">{form.client || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="font-semibold">Transportadora</span>
                <span className="text-right text-slate-600">{form.carrier || '—'}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
