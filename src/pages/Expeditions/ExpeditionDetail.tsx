import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Truck, ClipboardList, ShieldCheck, User, Info, Signature } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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
};

type ExpeditionPhoto = {
  id: string;
  photo_type: string;
  public_url: string;
  captured_at: string;
};

type ExpeditionDeliverySignature = {
  signer_name?: string | null;
  signer_document?: string | null;
  signer_role?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
};

const statusStyles: Record<string, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  em_transito: 'bg-amber-100 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado: 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_transito: 'Em Trânsito',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const statusProgress: Record<string, number> = {
  pendente: 20,
  em_transito: 50,
  concluido: 100,
  cancelado: 0,
};

const getProgressColor = (progress: number) => {
  if (progress >= 100) return 'bg-emerald-500';
  if (progress >= 75) return 'bg-blue-500';
  if (progress >= 50) return 'bg-amber-500';
  if (progress > 0) return 'bg-sky-500';
  return 'bg-rose-500';
};

export const ExpeditionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expedition, setExpedition] = useState<Expedition | null>(null);
  const [photos, setPhotos] = useState<ExpeditionPhoto[]>([]);
  const [deliverySignature, setDeliverySignature] = useState<ExpeditionDeliverySignature | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const loadExpedition = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('expeditions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao carregar expedição:', error.message);
        setError('Não foi possível carregar esta expedição.');
        setPhotos([]);
      } else {
        setExpedition(data);

        if (data?.id) {
          const { data: photoData, error: photoError } = await supabase
            .from('expedition_photos')
            .select('id, photo_type, public_url, captured_at')
            .eq('expedition_id', data.id)
            .order('captured_at', { ascending: true });

          if (photoError) {
            console.error('Erro ao carregar fotos da expedição:', photoError.message);
            setPhotos([]);
          } else {
            setPhotos(photoData ?? []);
          }

          const { data: deliveryData, error: deliveryError } = await supabase
            .from('deliveries')
            .select('signer_name, signer_document, signer_role, signed_at, signature_data')
            .eq('expedition_id', data.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (deliveryError) {
            console.error('Erro ao carregar assinatura da expedição:', deliveryError.message);
            setDeliverySignature(null);
          } else {
            setDeliverySignature(deliveryData ?? null);
          }
        }
      }
      setLoading(false);
    };

    loadExpedition();
  }, [id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Expedição</p>
          <h1 className="text-3xl font-bold text-slate-900">Detalhes da expedição</h1>
          <p className="max-w-2xl text-sm text-slate-500">Informações completas do pedido, transporte e status de entrega.</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
          Voltar para expedições
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-slate-500">Carregando expedição...</div>
      ) : error ? (
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-rose-600">{error}</div>
      ) : expedition ? (
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pedido</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{expedition.order_number}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Nota Fiscal</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{expedition.nf_number}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cliente</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{expedition.client_name}</p>
                      {expedition.client_email && (
                        <p className="text-xs text-slate-500 mt-1">{expedition.client_email}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Transportadora</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{expedition.carrier}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tipo de frete</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{expedition.freight_type}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Responsável</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{expedition.responsible || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Data da expedição</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{new Date(expedition.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Endereço de entrega</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{expedition.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">Status e progresso</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusStyles[expedition.status]}`}>
                    <ShieldCheck size={14} />
                    {statusLabels[expedition.status]}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Progresso estimado</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{`${statusProgress[expedition.status] ?? 0}%`}</p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                        <Truck size={16} />
                        Logística
                      </div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${getProgressColor(statusProgress[expedition.status] ?? 0)}`}
                        style={{ width: `${statusProgress[expedition.status] ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Última atualização</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{new Date(expedition.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Criado em</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{new Date(expedition.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500">
                  <CalendarDays size={18} />
                  <p className="text-xs uppercase tracking-[0.2em] font-semibold">Planejamento</p>
                </div>
                <p className="mt-4 text-sm text-slate-700">Acompanhe a expedição com suas principais informações e status de entrega.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-slate-500">
                  <ClipboardList size={18} />
                  <p className="text-xs uppercase tracking-[0.2em] font-semibold">Detalhes logísticos</p>
                </div>
                <p className="mt-4 text-sm text-slate-700">Transporte: {expedition.carrier} · Tipo de frete: {expedition.freight_type}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <MapPin size={18} />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold">Endereço de entrega</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{expedition.address}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <User size={18} />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold">Responsável</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{expedition.responsible || 'Não informado'}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <Info size={18} />
                <p className="text-xs uppercase tracking-[0.2em] font-semibold">Observações</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{expedition.observations || 'Nenhuma observação cadastrada.'}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fotos</p>
                  <p className="mt-2 text-sm text-slate-700">Registros visuais da expedição.</p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
              </div>

              {photos.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Nenhuma foto registrada para esta expedição.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <img
                        src={photo.public_url}
                        alt={photo.photo_type}
                        className="h-40 w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                      <div className="p-3">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{photo.photo_type.replaceAll('_', ' ')}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(photo.captured_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visão geral</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Dados rápidos da expedição</h2>

              <div className="mt-6 grid gap-4">
                <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <CalendarDays size={18} className="text-slate-500" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Data</p>
                    <p className="font-semibold text-slate-900">{new Date(expedition.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <Truck size={18} className="text-slate-500" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo de frete</p>
                    <p className="font-semibold text-slate-900">{expedition.freight_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <ClipboardList size={18} className="text-slate-500" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pedido</p>
                    <p className="font-semibold text-slate-900">{expedition.order_number}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assinatura</p>
              <div className="mt-6 space-y-4">
                {deliverySignature?.signed_at ? (
                  <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <Signature size={18} className="text-blue-600" />
                      <p className="text-sm font-semibold text-slate-900">Assinatura do cliente registrada</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Nome</p>
                        <p className="mt-1 font-semibold text-slate-900">{deliverySignature.signer_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Documento</p>
                        <p className="mt-1 font-semibold text-slate-900">{deliverySignature.signer_document || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Função</p>
                        <p className="mt-1 font-semibold text-slate-900">{deliverySignature.signer_role || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Data de assinatura</p>
                        <p className="mt-1 font-semibold text-slate-900">{new Date(deliverySignature.signed_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    {deliverySignature.signature_data && (
                      <div className="mt-3 bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-center">
                        <img src={deliverySignature.signature_data} alt="Desenho da Assinatura" className="max-h-40 w-auto object-contain" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                    Nenhuma assinatura de cliente registrada para esta expedição.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Linha do tempo</p>
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{statusLabels[expedition.status]}</p>
                  <p className="mt-1 text-sm text-slate-600">Status atual da expedição conforme o último resultado registrado.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-slate-500">Expedição não encontrada.</div>
      )}
    </div>
  );
};
