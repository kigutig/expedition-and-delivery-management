
import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Calendar, Filter, FileSpreadsheet, FileJson } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const reportTemplates = [
  { title: 'Relatório de Entregas', desc: 'Resumo completo de todas as entregas e NFs.', icon: FileText, color: 'blue' },
  { title: 'Índice de Garantias', desc: 'Visão de garantias ativas e vencidas.', icon: FileSpreadsheet, color: 'red' },
  { title: 'Performance Transportadora', desc: 'Prazos e qualidades por transportadora.', icon: FileJson, color: 'green' },
];

const colorStyles: Record<string, { wrapper: string; icon: string }> = {
  blue: { wrapper: 'bg-blue-50 text-blue-600', icon: 'text-blue-600' },
  red: { wrapper: 'bg-red-50 text-red-600', icon: 'text-red-600' },
  green: { wrapper: 'bg-emerald-50 text-emerald-600', icon: 'text-emerald-600' },
};

type DeliveryReportItem = {
  id: string;
  expedition_id: string | null;
  order_number: string;
  nf_number: string;
  customer_name: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
  driver_name: string | null;
  expedition_client_name: string | null;
};

type WarrantyReportItem = {
  id: string;
  customer_name: string | null;
  expedition_client_name: string | null;
  order_number: string | null;
  nf_number: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

type ExpeditionData = {
  id: string;
  carrier: string;
  status: string;
  created_at: string;
  responsible: string | null;
  order_number: string;
  nf_number: string;
  client_name: string;
};

type CarrierPerformanceItem = {
  carrier: string;
  total: number;
  concluded: number;
  in_transit: number;
  pending: number;
  average_days: number;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');

export const Reports = () => {
  const [period, setPeriod] = useState('Últimos 30 dias');
  const [status, setStatus] = useState('Todos');
  const [expeditor, setExpeditor] = useState('');
  const [activePreview, setActivePreview] = useState<string>('Relatório de Entregas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveries, setDeliveries] = useState<DeliveryReportItem[]>([]);
  const [warranties, setWarranties] = useState<WarrantyReportItem[]>([]);
  const [expeditions, setExpeditions] = useState<ExpeditionData[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [deliveriesResult, warrantiesResult, expeditionsResult] = await Promise.all([
          supabase
            .from('vw_deliveries')
            .select('id,expedition_id,order_number,nf_number,customer_name,status,created_at,finished_at,driver_name,expedition_client_name')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('vw_warranties')
            .select('id,customer_name,expedition_client_name,order_number,nf_number,start_date,end_date,status')
            .order('end_date', { ascending: true })
            .limit(500),
          supabase
            .from('expeditions')
            .select('id,carrier,status,created_at,responsible,order_number,nf_number,client_name')
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

        if (deliveriesResult.error || warrantiesResult.error || expeditionsResult.error) {
          console.error('Erro ao carregar relatórios:', deliveriesResult.error ?? warrantiesResult.error ?? expeditionsResult.error);
          setError('Falha ao carregar dados de relatórios. Tente novamente.');
          return;
        }

        setDeliveries(deliveriesResult.data || []);
        setWarranties(warrantiesResult.data || []);
        setExpeditions(expeditionsResult.data || []);
      } catch (err) {
        console.error('Erro inesperado ao carregar relatórios:', err);
        setError('Falha inesperada ao carregar relatórios.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getDateRange = (periodValue: string) => {
    const today = new Date();
    const start = new Date(today);

    switch (periodValue) {
      case 'Este Mês':
        start.setDate(1);
        break;
      case 'Último Trimestre':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'Personalizado':
        start.setMonth(start.getMonth() - 1);
        break;
      default:
        start.setDate(start.getDate() - 30);
        break;
    }

    return { from: start, to: today };
  };

  const normalizeStatus = (statusValue: string) => {
    const map: Record<string, string[]> = {
      Todos: [],
      Concluídas: ['concluido'],
      'Em Trânsito': ['em_transito'],
      Pendentes: ['pendente'],
    };
    return map[statusValue] || [];
  };

  const dateRange = getDateRange(period);

  const matchesExpeditor = (value?: string) => {
    if (!expeditor) return true;
    const search = expeditor.toLowerCase();
    return !!value?.toLowerCase().includes(search);
  };

  const filteredDeliveries = useMemo(() => {
    const statusFilter = normalizeStatus(status);
    return deliveries.filter((item) => {
      const date = new Date(item.created_at);
      const periodMatch = date >= dateRange.from && date <= dateRange.to;
      const statusMatch = status === 'Todos' || statusFilter.includes(item.status);
      const expeditorMatch =
        matchesExpeditor(item.customer_name) || matchesExpeditor(item.driver_name) || matchesExpeditor(item.expedition_client_name);
      return periodMatch && statusMatch && expeditorMatch;
    });
  }, [deliveries, dateRange.from, dateRange.to, status, expeditor]);

  const filteredWarranties = useMemo(() => {
    return warranties.filter((item) => {
      const date = new Date(item.start_date);
      const periodMatch = date >= dateRange.from && date <= dateRange.to;
      const expeditorMatch = matchesExpeditor(item.customer_name) || matchesExpeditor(item.expedition_client_name) || matchesExpeditor(item.order_number);
      return periodMatch && expeditorMatch;
    });
  }, [warranties, dateRange.from, dateRange.to, expeditor]);

  const filteredExpeditions = useMemo(() => {
    const statusFilter = normalizeStatus(status);
    return expeditions.filter((item) => {
      const date = new Date(item.created_at);
      const periodMatch = date >= dateRange.from && date <= dateRange.to;
      const statusMatch = status === 'Todos' || statusFilter.includes(item.status);
      const expeditorMatch = matchesExpeditor(item.responsible) || matchesExpeditor(item.client_name);
      return periodMatch && statusMatch && expeditorMatch;
    });
  }, [expeditions, dateRange.from, dateRange.to, status, expeditor]);

  const warrantyStatusSummary = useMemo(() => {
    const active = filteredWarranties.filter((item) => item.status === 'ativa').length;
    const expired = filteredWarranties.filter((item) => item.status === 'expirada').length;
    return { active, expired };
  }, [filteredWarranties]);

  const averageDeliveryTime = useMemo(() => {
    const durations = filteredDeliveries
      .map((item) => {
        if (!item.created_at || !item.finished_at) return null;
        const created = new Date(item.created_at).getTime();
        const finished = new Date(item.finished_at).getTime();
        if (Number.isNaN(created) || Number.isNaN(finished) || finished <= created) return null;
        return finished - created;
      })
      .filter((value): value is number => value !== null);

    if (!durations.length) return 0;
    const avgMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24));
  }, [filteredDeliveries]);

  const carrierPerformance = useMemo(() => {
    const expeditionById = Object.fromEntries(expeditions.map((item) => [item.id, item]));
    const grouped: Record<string, { carrier: string; total: number; concluded: number; in_transit: number; pending: number; durations: number[] }> = {};

    filteredExpeditions.forEach((expedition) => {
      const carrier = expedition.carrier || 'Sem transportadora';
      const item = grouped[carrier] || { carrier, total: 0, concluded: 0, in_transit: 0, pending: 0, durations: [] };
      item.total += 1;
      if (['concluido'].includes(expedition.status)) item.concluded += 1;
      if (expedition.status === 'em_transito') item.in_transit += 1;
      if (expedition.status === 'pendente') item.pending += 1;
      grouped[carrier] = item;
    });

    filteredDeliveries.forEach((delivery) => {
      const carrier = delivery.expedition_id ? expeditionById[delivery.expedition_id]?.carrier || 'Sem transportadora' : 'Sem transportadora';
      const item = grouped[carrier] || { carrier, total: 0, concluded: 0, in_transit: 0, pending: 0, durations: [] };
      if (delivery.finished_at && delivery.created_at) {
        const created = new Date(delivery.created_at).getTime();
        const finished = new Date(delivery.finished_at).getTime();
        if (!Number.isNaN(created) && !Number.isNaN(finished) && finished > created) {
          item.durations.push(finished - created);
        }
      }
      grouped[carrier] = item;
    });

    return Object.values(grouped).map((item) => {
      const averageDays = item.durations.length
        ? Math.round(item.durations.reduce((sum, value) => sum + value, 0) / item.durations.length / (1000 * 60 * 60 * 24))
        : 0;
      return {
        carrier: item.carrier,
        total: item.total,
        concluded: item.concluded,
        in_transit: item.in_transit,
        pending: item.pending,
        average_days: averageDays,
      };
    });
  }, [filteredDeliveries, filteredExpeditions, expeditions]);

  const downloadCsvFile = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const createExportPayload = () => {
    if (activePreviewTitle === 'Índice de Garantias') {
      return {
        headers: ['Pedido', 'NF', 'Cliente', 'Início', 'Fim', 'Status'],
        rows: filteredWarranties.map((item) => [item.order_number || '—', item.nf_number || '—', item.customer_name || item.expedition_client_name || '—', formatDate(item.start_date), formatDate(item.end_date), item.status]),
      };
    }

    if (activePreviewTitle === 'Performance Transportadora') {
      return {
        headers: ['Transportadora', 'Total', 'Concluídas', 'Em Trânsito', 'Pendentes', 'Tempo Médio (dias)'],
        rows: carrierPerformance.map((item) => [item.carrier, item.total, item.concluded, item.in_transit, item.pending, item.average_days]),
      };
    }

    return {
      headers: ['Pedido', 'NF', 'Cliente', 'Status', 'Data', 'Motorista', 'Expedição'],
      rows: filteredDeliveries.map((item) => [item.order_number, item.nf_number, item.customer_name || '—', item.status, formatDate(item.created_at), item.driver_name || '—', item.expedition_client_name || '—']),
    };
  };

  const handleExport = (format: 'CSV' | 'Excel') => {
    const title = activePreviewTitle.replace(/\s+/g, '_').toLowerCase();
    const fileName = format === 'Excel' ? `${title}_planilha.csv` : `${title}.csv`;
    const { headers, rows } = createExportPayload();
    downloadCsvFile(fileName, headers, rows);
  };

  const handleDownload = (title: string) => {
    if (title === 'Relatório de Entregas') {
      downloadCsvFile(
        `${title}.csv`,
        ['Pedido', 'NF', 'Cliente', 'Status', 'Data', 'Motorista', 'Expedição'],
        filteredDeliveries.slice(0, 200).map((item) => [item.order_number, item.nf_number, item.customer_name || '—', item.status, formatDate(item.created_at), item.driver_name || '—', item.expedition_client_name || '—'])
      );
    } else if (title === 'Índice de Garantias') {
      downloadCsvFile(
        `${title}.csv`,
        ['Pedido', 'NF', 'Cliente', 'Início', 'Fim', 'Status'],
        filteredWarranties.slice(0, 200).map((item) => [item.order_number || '—', item.nf_number || '—', item.customer_name || item.expedition_client_name || '—', formatDate(item.start_date), formatDate(item.end_date), item.status])
      );
    } else {
      downloadCsvFile(
        `${title}.csv`,
        ['Transportadora', 'Total', 'Concluídas', 'Em Trânsito', 'Pendentes', 'Tempo Médio (dias)'],
        carrierPerformance.map((item) => [item.carrier, item.total, item.concluded, item.in_transit, item.pending, item.average_days])
      );
    }
  };

  const activePreviewTitle = activePreview || 'Relatório de Entregas';

  const previewContent = () => {
    if (activePreviewTitle === 'Índice de Garantias') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pedido</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">NF</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Início</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Fim</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWarranties.slice(0, 5).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-sm text-slate-700">{item.order_number || '—'}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.nf_number || '—'}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.customer_name || item.expedition_client_name || '—'}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.start_date)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.end_date)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.status}</td>
                </tr>
              ))}
              {filteredWarranties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma garantia encontrada para os filtros selecionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activePreviewTitle === 'Performance Transportadora') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Transportadora</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Total</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Concluídas</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Em Trânsito</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pendentes</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Tempo Médio (dias)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carrierPerformance.map((item) => (
                <tr key={item.carrier} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-sm text-slate-700">{item.carrier}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.total}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.concluded}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.in_transit}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.pending}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.average_days}</td>
                </tr>
              ))}
              {carrierPerformance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma transportadora com dados no período selecionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Pedido</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">NF</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Data</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Motorista</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Expedição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDeliveries.slice(0, 5).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-4 text-sm text-slate-700">{item.order_number}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.nf_number}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.customer_name || '—'}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.status}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{formatDate(item.created_at)}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.driver_name || '—'}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{item.expedition_client_name || '—'}</td>
              </tr>
            ))}
            {filteredDeliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma entrega encontrada para os filtros selecionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const cards = [
    {
      title: 'Entregas filtradas',
      value: filteredDeliveries.length,
      description: 'Total de entregas no período selecionado.',
    },
    {
      title: 'Garantias válidas',
      value: warrantyStatusSummary.active,
      description: 'Garantias ativas no período atual.',
    },
    {
      title: 'Transportadoras ativas',
      value: carrierPerformance.length,
      description: 'Transportadoras com entregas registradas.',
    },
    {
      title: 'Tempo médio de entrega',
      value: averageDeliveryTime,
      description: 'Dias médios entre criação e finalização das entregas.',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Relatórios de Logística</h2>
        <p className="text-slate-500">Dados reais de entregas, garantias e performance de transportadoras.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Filter size={18} className="text-blue-600" />
              Filtros
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Período</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  >
                    <option>Últimos 30 dias</option>
                    <option>Este Mês</option>
                    <option>Último Trimestre</option>
                    <option>Personalizado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Status da Entrega</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                >
                  <option>Todos</option>
                  <option>Concluídas</option>
                  <option>Em Trânsito</option>
                  <option>Pendentes</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Expedidor</label>
                <input
                  value={expeditor}
                  onChange={(event) => setExpeditor(event.target.value)}
                  type="text"
                  placeholder="Nome do expedidor"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => setActivePreview(reportTemplates[0].title)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-100 mt-4"
            >
              Aplicar Filtros
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800">Resumo de Indicadores</h3>
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={card.title} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">{card.title}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="text-sm text-slate-500">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTemplates.map((item) => (
              <div
                key={item.title}
                className={`bg-white p-6 rounded-xl border ${activePreview === item.title ? 'border-blue-500 shadow-md' : 'border-slate-200 shadow-sm'} hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => setActivePreview(item.title)}
              >
                <div className={`${colorStyles[item.color].wrapper} rounded-xl w-12 h-12 flex items-center justify-center mb-4`}>
                  <item.icon size={24} />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500 mb-4">{item.desc}</p>
                <div className="flex gap-2">
                  <button onClick={(event) => { event.stopPropagation(); handleDownload(item.title); }} className="p-2 bg-slate-50 text-slate-600 rounded hover:bg-slate-100">
                    <Download size={16} />
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); setActivePreview(item.title); }}
                    className="flex-1 py-1.5 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800"
                  >
                    Visualizar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Visualização Prévia</h3>
                <p className="text-slate-500 text-sm">{activePreviewTitle}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleExport('CSV')} className="text-xs font-bold text-blue-600">Exportar CSV</button>
                <button onClick={() => handleExport('Excel')} className="text-xs font-bold text-green-600">Exportar Planilha</button>
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Carregando dados do relatório...</div>
              ) : (
                previewContent()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
