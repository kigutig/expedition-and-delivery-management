import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock, MapPin, User, Briefcase, Camera, CheckCircle2, Signature, Star, Download, FileText, QrCode, ShieldCheck, MoreVertical, Truck, XCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { MessageDialog } from '../../components/ui/MessageDialog';
interface DeliverySummary {
  id: string;
  order_number: string;
  nf_number: string;
  status: string;
  customer_id?: string;
  customer_name?: string;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  em_transito: 'bg-sky-100 text-sky-700 border-sky-200',
  entregue: 'bg-green-100 text-green-700 border-green-200',
  chegada: 'bg-violet-100 text-violet-700 border-violet-200',
  instalacao: 'bg-purple-100 text-purple-700 border-purple-200',
  assinatura: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  finalizado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  concluido: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelado: 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_transito: 'Em Trânsito',
  entregue: 'Entregue',
  chegada: 'Chegada',
  instalacao: 'Instalação',
  assinatura: 'Assinatura',
  finalizado: 'Finalizado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const statusIcons: Record<string, any> = {
  pendente: Clock,
  em_transito: Truck,
  entregue: CheckCircle2,
  chegada: MapPin,
  instalacao: Briefcase,
  assinatura: Signature,
  finalizado: ShieldCheck,
  concluido: CheckCircle,
  cancelado: XCircle,
};

export const DeliveryList = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteDeliveryId, setDeleteDeliveryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; title?: string; message: string }>({
    open: false,
    title: undefined,
    message: '',
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const loadDeliveries = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('vw_deliveries')
      .select('id, order_number, nf_number, status, customer_id, customer_name, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(fetchError);
      setError('Não foi possível carregar as entregas. Tente novamente.');
      setDeliveries([]);
    } else {
      setDeliveries(data ?? []);
    }

    setLoading(false);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 8, left: rect.left - 190 });
    setOpenMenuId(id);
  };

  const handleCloseMenu = () => {
    setOpenMenuId(null);
  };

  const addMonths = (date: Date, months: number) => {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  };

  const createWarrantyForDelivery = async (deliveryId: string) => {
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('deliveries')
      .select('id, expedition_id, customer_id')
      .eq('id', deliveryId)
      .maybeSingle();

    if (deliveryError || !deliveryData) {
      console.error('Falha ao buscar entrega para garantia:', deliveryError?.message);
      return;
    }

    const { data: existing } = await supabase
      .from('warranties')
      .select('id')
      .eq('delivery_id', deliveryId)
      .maybeSingle();

    if (existing) return;

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = addMonths(new Date(), 3).toISOString().slice(0, 10);

    const { error } = await supabase.from('warranties').insert({
      delivery_id: deliveryId,
      expedition_id: deliveryData.expedition_id,
      customer_id: deliveryData.customer_id,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
    });

    if (error) {
      console.error('Erro ao criar garantia da entrega:', error.message);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setLoading(true);
    if (newStatus === 'entregue') {
      navigate(`/entregas/${id}/editar?status=entregue`);
      handleCloseMenu();
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('deliveries')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      console.error('Erro ao atualizar status da entrega:', error.message);
    } else {
      if (newStatus === 'finalizado') {
        await createWarrantyForDelivery(id);
      }
      await loadDeliveries();
      handleCloseMenu();
    }
    setLoading(false);
  };

  const handleDeleteDelivery = (id: string) => {
    setDeleteDeliveryId(id);
  };

  const confirmDeleteDelivery = async () => {
    if (!deleteDeliveryId) return;
    setIsDeleting(true);

    const { error } = await supabase.from('deliveries').delete().eq('id', deleteDeliveryId);
    if (error) {
      console.error('Erro ao excluir entrega:', error.message);
      setMessageDialog({
        open: true,
        title: 'Erro',
        message: 'Falha ao excluir entrega. Veja o console para mais detalhes.',
      });
    } else {
      setDeliveries((prev) => prev.filter((delivery) => delivery.id !== deleteDeliveryId));
      handleCloseMenu();
    }

    setIsDeleting(false);
    setDeleteDeliveryId(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleCloseMenu();
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    loadDeliveries();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Entregas</h2>
          <p className="text-slate-500">Visualize o status e detalhes das entregas registradas.</p>
        </div>
        <button
          type="button"
          onClick={loadDeliveries}
          className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-200"
        >
          Recarregar
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">Carregando entregas...</div>
      )}

      {error && (
        <div className="bg-rose-50 text-rose-700 rounded-xl border border-rose-200 shadow-sm p-6">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Pedido</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">NF</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Data</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-slate-500 text-center">Nenhuma entrega encontrada.</td>
                  </tr>
                ) : (
                  deliveries.map((delivery) => {
                    const StatusIcon = statusIcons[delivery.status] || Star;
                    return (
                      <tr
                        key={delivery.id}
                        onClick={(e) => {
                          // Não navegar se clicou no botão de ações
                          if ((e.target as HTMLElement).closest('button')) return;
                          navigate(`/entregas/${delivery.id}`);
                        }}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-sm text-slate-700 font-semibold">{delivery.order_number}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{delivery.nf_number}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{delivery.customer_name || delivery.customer_id || '—'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusStyles[delivery.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            <StatusIcon size={14} />
                            {statusLabels[delivery.status] ?? delivery.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">{new Date(delivery.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={(event) => handleMenuClick(event, delivery.id)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {openMenuId && menuPosition && (
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, zIndex: 50 }}
              className="w-52 rounded-xl border border-slate-200 bg-white shadow-xl py-2"
            >
              <button
                onClick={() => {
                  navigate(`/entregas/${openMenuId}/editar`);
                  handleCloseMenu();
                }}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText size={16} className="inline-block mr-2" /> Editar
              </button>
              <button
                onClick={() => {
                  navigate(`/entregas/${openMenuId}`);
                  handleCloseMenu();
                }}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText size={16} className="inline-block mr-2" /> Ver Detalhes
              </button>
              <button
                onClick={() => handleUpdateStatus(openMenuId, 'em_transito')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Truck size={16} className="inline-block mr-2" /> Marcar em Trânsito
              </button>
              <button
                onClick={() => handleUpdateStatus(openMenuId, 'entregue')}
                className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                <CheckCircle size={16} className="inline-block mr-2" /> Marcar Entregue
              </button>
              <button
                onClick={() => handleDeleteDelivery(openMenuId)}
                className="w-full text-left px-4 py-3 text-sm text-rose-700 hover:bg-rose-50"
              >
                <XCircle size={16} className="inline-block mr-2" /> Excluir entrega
              </button>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteDeliveryId)}
        title="Confirmação"
        description="Deseja realmente excluir esta entrega?"
        confirmText="Excluir"
        cancelText="Cancelar"
        isLoading={isDeleting}
        onCancel={() => setDeleteDeliveryId(null)}
        onConfirm={confirmDeleteDelivery}
      />
      <MessageDialog
        open={messageDialog.open}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog({ open: false, title: undefined, message: '' })}
      />
    </div>
  );
};
