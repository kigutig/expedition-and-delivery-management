
import React, { useEffect, useMemo, useState } from 'react';
import { User, Shield, Plus, Mail, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MessageDialog } from '../../components/ui/MessageDialog';

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Ativo' | 'Em Entrega' | 'Bloqueado';
};

export const UserList = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'motorista' });
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserItem>>({ id: '', name: '', email: '', role: 'motorista', status: 'Ativo' });
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; title?: string; message: string }>({
    open: false,
    title: undefined,
    message: '',
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; userId: string | null }>({ open: false, userId: null });

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) {
        console.error('Falha ao carregar usuários reais:', error.message);
      } else if (data) {
        setUsers(data);
      }
      setLoading(false);
    };

    loadUsers();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        [user.name, user.email, user.role].some((value) => value.toLowerCase().includes(query.toLowerCase()))
      ),
    [users, query]
  );

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setMessageDialog({ open: true, title: 'Atenção', message: 'Informe nome, e-mail e senha para cadastrar o usuário.' });
      return;
    }

    // Validação simples de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      setMessageDialog({ open: true, title: 'Atenção', message: 'Informe um e-mail válido.' });
      return;
    }

    // Verificar se usuário já existe no cadastro para evitar erro de signup
    setSavingUser(true);
    try {
      const { data: existing, error: existingError } = await supabase.from('users').select('id, auth_id').eq('email', newUser.email).maybeSingle();
      if (existingError) {
        console.error('Erro ao verificar usuário existente:', existingError.message);
      }
      if (existing) {
        setMessageDialog({ open: true, title: 'Erro', message: 'Já existe um usuário cadastrado com este e-mail.' });
        setSavingUser(false);
        return;
      }
    } catch (err) {
      console.error('Erro ao verificar existência de usuário:', err);
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
    });

    if (authError) {
      // Se o erro indica que o e-mail já está registrado no Auth, tentamos criar só o registro local
      const isAlreadyRegistered = authError.message?.toLowerCase().includes('already registered') || authError.status === 422;
      if (isAlreadyRegistered) {
        try {
          const { data: existingUser } = await supabase.from('users').select('*').eq('email', newUser.email).maybeSingle();
          if (!existingUser) {
            const payload = {
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              status: 'Ativo',
              auth_id: null,
            };
            const { data: created, error: createErr } = await supabase.from('users').insert([payload]).select('*');
            if (!createErr && created && created.length > 0) {
              setUsers((current) => [...current, created[0]]);
              setMessageDialog({ open: true, title: 'Aviso', message: 'Conta de autenticação já existe; criei o registro local. Vincule manualmente o `auth_id` se necessário.' });
            } else {
              setMessageDialog({ open: true, title: 'Erro', message: 'Conta já existe no Auth, e falha ao criar registro local.' });
            }
          } else {
            setMessageDialog({ open: true, title: 'Aviso', message: 'Conta já existe no provedor de autenticação.' });
          }
        } catch (err) {
          console.error('Erro ao tratar conta já existente:', err);
          setMessageDialog({ open: true, title: 'Erro', message: 'Erro ao verificar/criar registro local para o e-mail existente.' });
        } finally {
          setSavingUser(false);
        }
        return;
      }

      console.error('Erro ao criar conta de autenticação:', authError.message);
      const msg = 'Não foi possível criar a conta de autenticação. Verifique o e-mail e tente novamente.';
      setMessageDialog({ open: true, title: 'Erro', message: msg });
      setSavingUser(false);
      return;
    }

    const authUserId = authData.user?.id || null;
    const payload = {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: 'Ativo',
      auth_id: authUserId,
    };

    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select('*');

    if (error) {
      console.error('Erro ao criar usuário:', error.message);
      setMessageDialog({ open: true, title: 'Erro', message: 'Não foi possível salvar o usuário no cadastro.' });
      setSavingUser(false);
      return;
    }

    if (data && data.length > 0) {
      setUsers((current) => [...current, data[0]]);
    } else {
      setUsers((current) => [
        ...current,
        { id: Date.now().toString(), name: newUser.name, email: newUser.email, role: newUser.role, status: 'Ativo' },
      ]);
    }

    setNewUser({ name: '', email: '', password: '', role: 'motorista' });
    setShowAdd(false);
    setSavingUser(false);
  };

  const toggleBlock = (id: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === id ? { ...user, status: user.status === 'Bloqueado' ? 'Ativo' : 'Bloqueado' } : user
      )
    );
  };

  const handleEdit = (id: string) => {
    const user = users.find((item) => item.id === id);
    if (!user) return;
    setSelectedUser(user);
    setEditForm({ ...user });
    setShowAdd(false);
  };

  const handleSaveEdit = async () => {
    if (!editForm.id || !editForm.name?.trim() || !editForm.email?.trim()) return;
    setSavingUser(true);

    const payload = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      status: editForm.status,
    };

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', editForm.id)
      .select('*');

    if (error) {
      console.error('Falha ao atualizar usuário:', error.message);
    } else if (data && data.length > 0) {
      setUsers((current) => current.map((item) => (item.id === editForm.id ? data[0] : item)));
      setSelectedUser(data[0]);
    }

    setSavingUser(false);
  };

  const handleCancelEdit = () => {
    setSelectedUser(null);
    setEditForm({ id: '', name: '', email: '', role: 'motorista', status: 'Ativo' });
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir usuário:', error.message);
      setMessageDialog({ open: true, title: 'Erro', message: 'Não foi possível excluir o usuário. Tente novamente.' });
    } else {
      setUsers((current) => current.filter((u) => u.id !== id));
      if (selectedUser?.id === id) handleCancelEdit();
      setMessageDialog({ open: true, title: 'Sucesso', message: 'Usuário excluído com sucesso.' });
    }
    setConfirmDelete({ open: false, userId: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h2>
          <p className="text-sm text-slate-500">Crie e gerencie permissões dos membros do time.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => setShowAdd((prev) => !prev)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Plus size={18} />
            {showAdd ? 'Cancelar' : 'Novo Usuário'}
          </button>
          <div className="relative w-full sm:w-72">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              placeholder="Buscar usuário..."
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500 text-sm">
          Carregando usuários reais...
        </div>
      ) : null}

      {showAdd && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Cadastrar novo usuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              value={newUser.name}
              onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              placeholder="E-mail"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              placeholder="Senha"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="motorista">Motorista</option>
              <option value="expedicao">Expedição</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            onClick={handleAddUser}
            disabled={savingUser}
            className="bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-60"
          >
            {savingUser ? 'Salvando...' : 'Salvar Usuário'}
          </button>
        </div>
      )}

      {selectedUser && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Editar usuário</h3>
              <p className="text-sm text-slate-500">Atualize as informações do usuário selecionado.</p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-slate-500 hover:text-slate-800 text-sm font-semibold"
            >
              Cancelar edição
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              value={editForm.name || ''}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              value={editForm.email || ''}
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="E-mail"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <select
              value={editForm.role || 'motorista'}
              onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="motorista">Motorista</option>
              <option value="expedicao">Expedição</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              value={editForm.status || 'Ativo'}
              onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as UserItem['status'] }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="Ativo">Ativo</option>
              <option value="Em Entrega">Em Entrega</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>
          </div>
          <button
            onClick={handleSaveEdit}
            disabled={savingUser}
            className="bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-60"
          >
            {savingUser ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredUsers.map((u) => (
          <div
            key={u.id}
            onClick={() => handleEdit(u.id)}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 cursor-pointer hover:border-blue-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 border border-slate-200 uppercase font-bold text-xl">
                {u.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-slate-800">{u.name}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 uppercase">{u.role}</span>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Mail size={14} /> {u.email}
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Shield size={14} /> Status: <span className={u.status === 'Ativo' ? 'text-green-600 font-bold' : u.status === 'Bloqueado' ? 'text-red-600 font-bold' : 'text-blue-600 font-bold'}>{u.status}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleEdit(u.id);
                }}
                className="flex-1 py-1.5 bg-slate-50 text-slate-600 rounded text-xs font-bold hover:bg-slate-100"
              >
                Editar
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  toggleBlock(u.id);
                }}
                className="flex-1 py-1.5 bg-orange-50 text-orange-600 rounded text-xs font-bold hover:bg-orange-100"
              >
                {u.status === 'Bloqueado' ? 'Desbloquear' : 'Bloquear'}
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmDelete({ open: true, userId: u.id });
                }}
                title="Excluir usuário"
                className="py-1.5 px-2 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1"
              >
                <Trash2 size={13} />
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
      <MessageDialog
        open={messageDialog.open}
        title={messageDialog.title}
        message={messageDialog.message}
        onClose={() => setMessageDialog({ open: false, title: undefined, message: '' })}
      />

      {/* Confirmação de exclusão */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Excluir usuário</h3>
                <p className="text-sm text-slate-500">Essa ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-slate-600 text-sm">
              Tem certeza que deseja excluir o usuário{' '}
              <strong className="text-slate-800">
                {users.find((u) => u.id === confirmDelete.userId)?.name}
              </strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete({ open: false, userId: null })}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete.userId && handleDeleteUser(confirmDelete.userId)}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
