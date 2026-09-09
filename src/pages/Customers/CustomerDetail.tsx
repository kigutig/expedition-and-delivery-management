import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Delivery {
  id: string;
  order_number: string;
  nf_number: string;
  status: string;
  created_at: string;
}

export const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      const { data: customerData } = await supabase.from('customers').select('*').eq('id', id).single();
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, order_number, nf_number, status, created_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      setCustomer(customerData ?? null);
      setHistory(deliveries ?? []);
      setLoading(false);
    };

    load();
  }, [id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Detalhes do Cliente</h2>
          <p className="text-slate-500">Histórico completo de entregas e informações cadastrais.</p>
        </div>
        <button onClick={() => navigate('/clientes')} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-200">Voltar para clientes</button>
      </div>

      {!customer && loading && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">Carregando informações...</div>}
      {!customer && !loading && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-rose-600">Cliente não encontrado.</div>}

      {customer && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{customer.name}</h3>
              <p className="text-sm text-slate-500">{customer.company_name || 'Cliente sem razão social cadastrada'}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documento</p>
                <p className="mt-2 text-sm text-slate-700">{customer.document || 'Não informado'}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Contato</p>
                <p className="mt-2 text-sm text-slate-700">{customer.phone || '—'}</p>
                <p className="text-sm text-slate-700">{customer.email || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cidade / Estado</p>
                <p className="mt-2 text-sm text-slate-700">{customer.city || '—'} / {customer.state || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Endereço</p>
                <p className="mt-2 text-sm text-slate-700">{customer.address || 'Não informado'}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Ações rápidas</h3>
            <button onClick={() => navigate(`/clientes/${customer.id}`)} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold">Abrir histórico de entregas</button>
          </section>
        </div>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Histórico de Entregas</h3>
            <p className="text-sm text-slate-500">Todas as entregas registradas para esse cliente.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Pedido</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">NF</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-slate-500 text-center">Nenhuma entrega encontrada para este cliente.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/entregas/${item.id}`)}>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.order_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.nf_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{item.status.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
