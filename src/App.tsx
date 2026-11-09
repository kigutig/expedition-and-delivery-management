
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { supabase } from './lib/supabase';
import { ExpeditionList } from './pages/Expeditions/ExpeditionList';
import { ExpeditionDetail } from './pages/Expeditions/ExpeditionDetail';
import { NewExpedition } from './pages/Expeditions/NewExpedition';
import { DeliveryList } from './pages/Deliveries/DeliveryList';
import { DeliveryDetail } from './pages/Deliveries/DeliveryDetail';
import { WarrantyList } from './pages/Warranties/WarrantyList';
import { WarrantyDetail } from './pages/Warranties/WarrantyDetail';
import { FeedbackList } from './pages/Feedbacks/FeedbackList';
import { Reports } from './pages/Reports/Reports';
import { Login } from './pages/Login';
import { UserList } from './pages/Users/UserList';
import { CustomerList } from './pages/Customers/CustomerList';
import { CustomerDetail } from './pages/Customers/CustomerDetail';
import { Settings } from './pages/Settings';
import { DebugDeliveries } from './pages/Debug/DebugDeliveries';

const Placeholder = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-4">
    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
      <Icon size={40} />
    </div>
    <div className="text-center">
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      <p className="text-sm">Esta funcionalidade está em desenvolvimento.</p>
    </div>
  </div>
);

function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      } catch (err) {
        console.warn('[Supabase Auth] Falha ao obter sessão inicial:', err);
        setSession(null);
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={session ? <Layout><Dashboard /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/expedicoes"
          element={session ? <Layout><ExpeditionList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/expedicoes/nova"
          element={session ? <Layout><NewExpedition /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/expedicoes/:id/editar"
          element={session ? <Layout><NewExpedition /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/expedicoes/:id"
          element={session ? <Layout><ExpeditionDetail /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/entregas"
          element={session ? <Layout><DeliveryList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/entregas/:id/editar"
          element={session ? <Layout><DeliveryDetail mode="edit" /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/entregas/:id"
          element={session ? <Layout><DeliveryDetail mode="view" /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/clientes"
          element={session ? <Layout><CustomerList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/clientes/:id"
          element={session ? <Layout><CustomerDetail /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/feedbacks"
          element={session ? <Layout><FeedbackList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/garantias"
          element={session ? <Layout><WarrantyList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/garantias/:id"
          element={session ? <Layout><WarrantyDetail /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/relatorios"
          element={session ? <Layout><Reports /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/usuarios"
          element={session ? <Layout><UserList /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/configuracoes"
          element={session ? <Layout><Settings /></Layout> : <Navigate to="/login" replace />}
        />
        <Route
          path="/debug/entregas"
          element={session ? <Layout><DebugDeliveries /></Layout> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to={session ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
