import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Star,
  Package,
  TrendingUp,
  ArrowUpRight,
  FileBarChart,
  Plus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard, type StatTone } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/Badge';

type DashboardStat = {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: StatTone;
};

type ExpeditionRow = {
  id: string;
  client_name?: string;
  order_number?: string;
  nf_number?: string;
  status?: string;
  date?: string;
};

const statusColors = {
  pendente: '#d97706',
  em_transito: '#2563eb',
  entregue: '#15803d',
  finalizado: '#0d9488',
  concluido: '#0284c7',
  cancelado: '#b91c1c',
};

const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e6e8ee',
  boxShadow: '0 18px 40px -20px rgba(15,23,42,.3)',
  fontSize: 12,
  padding: '8px 12px',
} as const;

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [deliveryData, setDeliveryData] = useState<{ name: string; total: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentExpeditions, setRecentExpeditions] = useState<ExpeditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('carregando...');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [deliveriesResult, expeditionsResult, feedbacksResult, warrantiesResult] = await Promise.all([
          supabase.from('deliveries').select('id,status,created_at,order_number,nf_number'),
          supabase
            .from('expeditions')
            .select('id,client_name,order_number,nf_number,status,date')
            .order('date', { ascending: false })
            .limit(6),
          supabase.from('feedbacks').select('rating'),
          supabase.from('vw_warranties').select('id,status'),
        ]);

        const deliveries = deliveriesResult.data ?? [];
        const expeditions = expeditionsResult.data ?? [];
        const feedbacks = feedbacksResult.data ?? [];
        const warranties = warrantiesResult.data ?? [];

        if (warrantiesResult.error) {
          console.error('Erro ao carregar garantias no dashboard:', warrantiesResult.error);
        }

        const pendingDeliveries = deliveries.filter(
          (item) => item.status === 'pendente' || item.status === 'em_transito',
        ).length;
        const completedDeliveries = deliveries.filter(
          (item) => item.status === 'entregue' || item.status === 'finalizado' || item.status === 'concluido',
        ).length;
        const activeWarranties = warranties.filter((item: any) => item.status === 'active').length;
        const averageRating = feedbacks.length
          ? (feedbacks.reduce((sum, item) => sum + (item.rating ?? 0), 0) / feedbacks.length).toFixed(1)
          : '0.0';

        const monthlyMap = new Map<string, number>();
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (5 - index));
          return monthNames[date.getMonth()];
        });
        lastSixMonths.forEach((month) => monthlyMap.set(month, 0));

        deliveries.forEach((item) => {
          const date = item.created_at ? new Date(item.created_at) : null;
          if (!date || Number.isNaN(date.getTime())) return;
          const month = monthNames[date.getMonth()];
          if (monthlyMap.has(month)) monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1);
        });

        const statusCounts = deliveries.reduce<Record<string, number>>((acc, item) => {
          const key = item.status || 'outros';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});

        setStats([
          {
            label: 'Expedições em andamento',
            value: String(expeditions.filter((item) => item.status === 'pendente' || item.status === 'em_transito').length),
            icon: Package,
            tone: 'brand',
          },
          { label: 'Entregas concluídas', value: String(completedDeliveries), icon: CheckCircle2, tone: 'success' },
          { label: 'Entregas pendentes', value: String(pendingDeliveries), icon: Clock, tone: 'warning' },
          { label: 'Garantias ativas', value: String(activeWarranties), icon: ShieldCheck, tone: 'info' },
          { label: 'Feedback médio', value: `${averageRating}/5`, icon: Star, tone: 'warning' },
          { label: 'Feedbacks registrados', value: String(feedbacks.length), icon: TrendingUp, tone: 'success' },
        ]);

        setDeliveryData(lastSixMonths.map((name) => ({ name, total: monthlyMap.get(name) ?? 0 })));
        setStatusData(
          Object.entries(statusCounts).map(([key, value]) => ({
            name: key.replace('_', ' ').replace(/^(.)/, (match) => match.toUpperCase()),
            value,
            color: statusColors[key as keyof typeof statusColors] ?? '#94a3b8',
          })),
        );
        setRecentExpeditions(expeditions);
        setLastUpdate(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const statusTotal = useMemo(() => statusData.reduce((sum, item) => sum + item.value, 0), [statusData]);

  const statRoutes: Record<string, string> = {
    'Expedições em andamento': '/expedicoes',
    'Entregas concluídas': '/entregas',
    'Entregas pendentes': '/entregas',
    'Garantias ativas': '/garantias',
    'Feedback médio': '/feedbacks',
    'Feedbacks registrados': '/feedbacks',
  };

  const placeholderStats: DashboardStat[] = [
    { label: 'Expedições em andamento', value: '—', icon: Package, tone: 'brand' },
    { label: 'Entregas concluídas', value: '—', icon: CheckCircle2, tone: 'success' },
    { label: 'Entregas pendentes', value: '—', icon: Clock, tone: 'warning' },
    { label: 'Garantias ativas', value: '—', icon: ShieldCheck, tone: 'info' },
    { label: 'Feedback médio', value: '—', icon: Star, tone: 'warning' },
    { label: 'Feedbacks registrados', value: '—', icon: TrendingUp, tone: 'success' },
  ];

  const visibleStats = stats.length ? stats : placeholderStats;

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard de logística"
        description={`Dados em tempo real da operação · atualizado em ${lastUpdate}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/relatorios')}>
              <FileBarChart size={16} />
              Relatórios
            </Button>
            <Button onClick={() => navigate('/expedicoes/nova')}>
              <Plus size={16} />
              Nova expedição
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {visibleStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            tone={stat.tone}
            icon={stat.icon}
            loading={loading}
            onClick={statRoutes[stat.label] ? () => navigate(statRoutes[stat.label]) : undefined}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Entregas por mês" description="Volume registrado nos últimos 6 meses." />
          <div className="h-[300px] w-full">
            {deliveryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#eceef4" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7c879b', fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7c879b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(37,99,235,.06)' }} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total" name="Entregas" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="skeleton h-full w-full" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Distribuição por status" description="Participação de cada etapa do fluxo." />
          <div className="relative h-[220px] w-full">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={62} outerRadius={86} paddingAngle={3} dataKey="value" stroke="none">
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[30px] font-bold leading-none tracking-tight text-ink">{statusTotal}</span>
                  <span className="text-eyebrow mt-1">Entregas</span>
                </div>
              </>
            ) : (
              <div className="skeleton h-full w-full rounded-full" />
            )}
          </div>
          <div className="mt-5 space-y-2.5 border-t border-line pt-4">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="text-[13px] font-bold text-ink">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <Card flush>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h3 className="text-[15px] font-bold text-ink">Últimas expedições</h3>
              <p className="mt-0.5 text-[13px] text-ink-soft">Registros mais recentes criados no sistema.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/expedicoes')}>
              Ver todas
              <ArrowUpRight size={15} />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : recentExpeditions.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentExpeditions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/expedicoes/${item.id}`)}
                    className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-brand-50/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-muted text-ink-soft">
                      <Package size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {item.client_name ?? 'Cliente não identificado'}
                      </span>
                      <span className="block text-[12.5px] text-ink-faint">
                        NF {item.nf_number ?? '—'} · Pedido {item.order_number ?? '—'}
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block text-[12px] font-medium text-ink-soft">
                        {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </span>
                    <StatusBadge status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-ink">Nenhuma expedição recente</p>
              <p className="mt-1 text-[13px] text-ink-faint">Crie a primeira expedição para começar a acompanhar.</p>
              <Button className="mt-4" onClick={() => navigate('/expedicoes/nova')}>
                <Plus size={16} />
                Nova expedição
              </Button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
};
