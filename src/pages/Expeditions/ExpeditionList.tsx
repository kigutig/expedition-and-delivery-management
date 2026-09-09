
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Printer,
  Truck,
  CheckCircle,
  Clock,
  ArrowRight,
  Edit,
  Eye,
  Trash2,
  Download,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { MessageDialog } from '../../components/ui/MessageDialog';

type Expedition = {
  id: string;
  date: string;
  nf_number: string;
  order_number: string;
  client_name: string;
  status: string;
  carrier: string;
  freight_type: string;
};

const statusStyles: Record<string, string> = {
  pendente: 'bg-slate-100 text-slate-700 border-slate-200',
  em_transito: 'bg-amber-100 text-amber-700 border-amber-200',
  concluido: 'bg-green-100 text-green-700 border-green-200',
  entregue: 'bg-green-100 text-green-700 border-green-200',
  cancelado: 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_transito: 'Em Trânsito',
  concluido: 'Concluído',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const statusProgress: Record<string, number> = {
  pendente: 20,
  em_transito: 50,
  concluido: 100,
  entregue: 100,
  cancelado: 0,
};

const getProgressColor = (progress: number) => {
  if (progress >= 100) return 'bg-emerald-500';
  if (progress >= 50) return 'bg-amber-500';
  if (progress > 0) return 'bg-sky-500';
  return 'bg-rose-500';
};

const statusIcons: Record<string, any> = {
  pendente: Clock,
  em_transito: Truck,
  concluido: CheckCircle,
  entregue: CheckCircle,
  cancelado: XCircle,
};

export const ExpeditionList = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; title?: string; message: string }>({
    open: false,
    title: undefined,
    message: '',
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const pageSize = 4;

  const loadExpeditions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('expeditions')
        .select('id,date,nf_number,order_number,client_name,status,carrier,freight_type')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar expedições:', error);
        console.error('Detalhes do erro:', { 
          message: error.message, 
          code: error.code, 
          details: error.details 
        });
        setError(`Erro ao carregar expedições: ${error.message}`);
        setExpeditions([]);
      } else if (data) {
        console.log(`Expedições carregadas: ${data?.length ?? 0}`, data);
        setExpeditions(data ?? []);
        setError('');
      } else {
        setExpeditions([]);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro ao conectar ao servidor');
      setExpeditions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExpeditions();
  }, []);

  const filteredExpeditions = useMemo(() => {
    return expeditions.filter((item) => {
      const matchesSearch = [item.nf_number, item.order_number, item.client_name, item.carrier].some((value) =>
        (value || '').toLowerCase().includes(search.toLowerCase())
      );
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, expeditions]);

  const pageCount = Math.max(1, Math.ceil(filteredExpeditions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedExpeditions = filteredExpeditions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    const headers = ['NF', 'Pedido', 'Cliente', 'Status', 'Transportadora', 'Tipo de Carga'];
    const headerRow = headers.join(';');
    
    const content = filteredExpeditions
      .map((item) => `${item.nf_number};${item.order_number};${item.client_name};${statusLabels[item.status]};${item.carrier};${item.freight_type}`)
      .join('\n');

    const csv = `${headerRow}\n${content}`;
    
    // Create blob and download as file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `expedicoes_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessageDialog({
      open: true,
      title: 'Sucesso',
      message: `Arquivo com ${filteredExpeditions.length} expedições baixado com sucesso.`,
    });
  };

  const handleDeleteExpedition = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDeleteExpedition = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);

    const { error } = await supabase.from('expeditions').delete().eq('id', confirmDeleteId);
    if (error) {
      console.error('Erro ao deletar:', error);
      setMessageDialog({
        open: true,
        title: 'Erro',
        message: 'Falha ao deletar expedição. Veja o console para mais detalhes.',
      });
    } else {
      setExpeditions((prev) => prev.filter((e) => e.id !== confirmDeleteId));
      setOpenMenuId(null);
    }

    setIsDeleting(false);
    setConfirmDeleteId(null);
  };

  const addMonths = (date: Date, months: number) => {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  };

  const createWarrantyForExpedition = async (expeditionId: string) => {
    const { data: expeditionData, error: expeditionError } = await supabase
      .from('expeditions')
      .select('id, customer_id')
      .eq('id', expeditionId)
      .maybeSingle();

    if (expeditionError || !expeditionData) {
      console.error('Falha ao buscar expedição para garantia:', expeditionError?.message);
      return;
    }

    const { data: existing } = await supabase
      .from('warranties')
      .select('id')
      .eq('expedition_id', expeditionId)
      .maybeSingle();

    if (existing) return;

    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = addMonths(new Date(), 3).toISOString().slice(0, 10);

    const { error } = await supabase.from('warranties').insert({
      expedition_id: expeditionId,
      customer_id: expeditionData.customer_id,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
    });

    if (error) {
      console.error('Erro ao criar garantia da expedição:', error);
    }
  };

  const getOrCreateDeliveryForExpedition = async (expeditionId: string) => {
    const { data: existingDelivery, error: existingDeliveryError } = await supabase
      .from('deliveries')
      .select('id')
      .eq('expedition_id', expeditionId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingDeliveryError) {
      console.error('Erro ao buscar entrega associada:', existingDeliveryError.message);
      return null;
    }

    if (existingDelivery?.id) {
      return existingDelivery.id;
    }

    const { data: expeditionData, error: expeditionDataError } = await supabase
      .from('expeditions')
      .select('order_number, nf_number, customer_id, responsible_user_id')
      .eq('id', expeditionId)
      .maybeSingle();

    if (expeditionDataError || !expeditionData) {
      console.error('Erro ao buscar dados da expedição para criar entrega:', expeditionDataError?.message);
      return null;
    }

    const { data: newDelivery, error: createError } = await supabase
      .from('deliveries')
      .insert([
        {
          expedition_id: expeditionId,
          order_number: expeditionData.order_number,
          nf_number: expeditionData.nf_number,
          status: 'entregue',
          driver_user_id: expeditionData.responsible_user_id || null,
          customer_id: expeditionData.customer_id || null,
        },
      ])
      .select('id')
      .single();

    if (createError || !newDelivery?.id) {
      console.error('Erro ao criar entrega associada:', createError?.message || 'Resposta inesperada do servidor');
      return null;
    }

    return newDelivery.id;
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { data, error } = await supabase
        .from('expeditions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Erro ao atualizar:', error);
      } else {
        console.log('Status atualizado com sucesso:', data);
        if (newStatus === 'entregue' || newStatus === 'finalizado') {
          await createWarrantyForExpedition(id);
        }

        if (newStatus === 'entregue') {
          const deliveryId = await getOrCreateDeliveryForExpedition(id);
          if (deliveryId) {
            navigate(`/entregas/${deliveryId}/editar`);
          } else {
            await loadExpeditions();
          }
        } else {
          await loadExpeditions();
        }

        setOpenMenuId(null);
      }
    } catch (err) {
      console.error('Erro na atualização:', err);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, itemId: string) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left - 180,
    });
    setOpenMenuId(itemId);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Expedições</h2>
          <p className="text-slate-500">Gerencie todos os envios e rastreamento.</p>
        </div>
        <button
          onClick={() => navigate('/expedicoes/nova')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={18} />
          Nova Expedição
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              type="text"
              placeholder="Pesquisar por NF, cliente ou transportadora..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowFilter((prev) => !prev)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Filter size={18} />
              Filtros
            </button>
            <button
              onClick={loadExpeditions}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Recarregar
            </button>
            <button
              onClick={handleExport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer size={18} />
              Exportar
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setStatusFilter('pendente');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusFilter === 'pendente' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              Pendentes
            </button>
            <button
              onClick={() => {
                setStatusFilter('em_transito');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusFilter === 'em_transito' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              Em Trânsito
            </button>
            <button
              onClick={() => {
                setStatusFilter('concluido');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusFilter === 'concluido' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              Concluídas
            </button>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
            <p className="font-semibold">Falha ao carregar expedições</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadExpeditions} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold">
              Tentar novamente
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando expedições...</div>
        ) : null}

        {!loading && !error && expeditions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-semibold">Nenhuma expedição encontrada</p>
            <p className="text-sm mt-1">Comece criando uma nova expedição.</p>
          </div>
        ) : null}

        {!loading ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">NF / Pedido</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Cliente</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Data</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Transportadora</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Frete</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpeditions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                        Nenhum resultado encontrado para a busca.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpeditions.map((item) => {
                      const StatusIcon = statusIcons[item.status] || Clock;
                      return (
                        <tr
                          key={item.id}
                          onClick={(e) => {
                            // Não navegar se clicou no botão de ações
                            if ((e.target as HTMLElement).closest('button')) return;
                            navigate(`/expedicoes/${item.id}`);
                          }}
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${statusStyles[item.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              <StatusIcon size={12} />
                              {statusLabels[item.status] || item.status}
                            </div>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${getProgressColor(statusProgress[item.status] ?? 0)}`}
                                style={{ width: `${statusProgress[item.status] ?? 0}%` }}
                              />
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500">{`${statusProgress[item.status] ?? 0}%`}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">NF {item.nf_number}</span>
                              <span className="text-xs text-slate-500">Pedido #{item.order_number}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                {item.client_name?.charAt(0) ?? 'C'}
                              </div>
                              <span className="text-sm font-medium text-slate-700">{item.client_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600 font-medium">{item.carrier}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              item.freight_type === 'CIF' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-700 bg-slate-50'
                            }`}>
                              {item.freight_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => handleMenuClick(e, item.id)}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
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

            <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                Mostrando <span className="font-bold">{paginatedExpeditions.length}</span> de <span className="font-bold">{filteredExpeditions.length}</span> resultados
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Anterior
                </button>
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => setPage(index + 1)}
                    className={`px-3 py-1 rounded text-xs font-semibold ${currentPage === index + 1 ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                  disabled={currentPage === pageCount}
                  className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Próximo
                </button>
              </div>
            </div>
          </>
        ) : null}

        {/* Floating Action Menu */}
        {openMenuId && menuPosition && (
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: 9999,
            }}
            className="w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in duration-100"
          >
            {expeditions.find((e) => e.id === openMenuId) && (
              <>
                <button
                  onClick={() => {
                    navigate(`/expedicoes/${openMenuId}`);
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <Eye size={16} />
                  Ver Detalhes
                </button>

                <button
                  onClick={() => {
                    navigate(`/expedicoes/${openMenuId}/editar`);
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                >
                  <Edit size={16} />
                  Editar
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  onClick={() => {
                    handleUpdateStatus(openMenuId, 'em_transito');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                >
                  <Truck size={16} />
                  Marcar em Trânsito
                </button>

                <button
                  onClick={() => {
                    handleUpdateStatus(openMenuId, 'entregue');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                  <CheckCircle size={16} />
                  Marcar Entregue
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  onClick={() => {
                    handleExport();
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                  <Download size={16} />
                  Baixar Dados
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  onClick={() => {
                    handleDeleteExpedition(openMenuId);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={16} />
                  Deletar
                </button>
              </>
            )}
          </div>
        )}

        <ConfirmDialog
          open={Boolean(confirmDeleteId)}
          title="Confirmar exclusão"
          description="Deseja realmente excluir esta expedição? Essa ação não pode ser desfeita."
          confirmText="Excluir"
          cancelText="Cancelar"
          isLoading={isDeleting}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={confirmDeleteExpedition}
        />

        <MessageDialog
          open={messageDialog.open}
          title={messageDialog.title}
          message={messageDialog.message}
          onClose={() => setMessageDialog({ open: false, title: undefined, message: '' })}
        />
      </div>
    </div>
  );
};
