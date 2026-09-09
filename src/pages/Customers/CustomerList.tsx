import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export const CustomerList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error.message);
    } else {
      setCustomers(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreate = () => {
    setSelected(null);
    setForm({});
    setMode('create');
  };


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: form.name,
      company_name: form.company_name,
      document: form.document,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      state: form.state,
    };

    if (mode === 'create') {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) {
        console.error(error.message);
      } else {
        setForm({});
        loadCustomers();
      }
    } else if (selected) {
      const { error } = await supabase.from('customers').update(payload).eq('id', selected.id);
      if (error) {
        console.error(error.message);
      } else {
        setSelected(null);
        setForm({});
        setMode('create');
        loadCustomers();
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Clientes</h2>
          <p className="text-slate-500">Cadastre, edite e acompanhe o histórico de entregas do cliente.</p>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-200">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800">Lista de Clientes</h3>
              <p className="text-sm text-slate-500">{loading ? 'Carregando...' : `${customers.length} clientes cadastrados`}</p>
            </div>
          </div>

          {customers.length === 0 && !loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => navigate(`/clientes/${customer.id}`)}
                  className="w-full text-left rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-slate-900 truncate">{customer.name}</p>
                      <p className="mt-1 text-sm text-slate-500 truncate">{customer.email || 'E-mail não informado'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{customer.document || 'Sem documento'}</span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{customer.phone || 'Sem telefone'}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Endereço:</span> {customer.address || 'Não informado'}{customer.city ? ` • ${customer.city}` : ''}{customer.state ? `/${customer.state}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800">{mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
              <p className="text-sm text-slate-500">Preencha os dados para cadastrar ou atualizar o cliente.</p>
            </div>
            {selected && <span className="text-xs text-blue-600 font-bold">Editando</span>}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {[
              { name: 'name', label: 'Nome completo', placeholder: 'Nome do cliente' },
              { name: 'company_name', label: 'Razão social', placeholder: 'Empresa ou academia' },
              { name: 'document', label: 'Documento', placeholder: 'CPF/CNPJ' },
              { name: 'email', label: 'E-mail', placeholder: 'contato@cliente.com' },
              { name: 'phone', label: 'Telefone', placeholder: '(11) 99999-9999' },
              { name: 'address', label: 'Endereço', placeholder: 'Rua, número, bairro' },
              { name: 'city', label: 'Cidade', placeholder: 'São Paulo' },
              { name: 'state', label: 'Estado', placeholder: 'SP' },
            ].map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{field.label}</label>
                <input
                  value={(form as any)[field.name] ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            ))}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all">{mode === 'create' ? 'Cadastrar Cliente' : 'Salvar Alterações'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
