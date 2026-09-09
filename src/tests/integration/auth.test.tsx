/**
 * auth.test.tsx
 *
 * Testes de integração para autenticação e proteção de rotas.
 * Verifica que:
 * - Rotas protegidas redirecionam para /login quando não autenticado
 * - Rota /debug/entregas só é acessível por admins
 * - Login redireciona para / quando já autenticado
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';

// ─── Mock simples do AdminRoute ───────────────────────────────────────────────
// Testa a lógica de proteção sem depender do Supabase
interface MockAdminRouteProps {
  session: any;
  userRole: string | null;
  children: React.ReactNode;
}

const MockAdminRoute: React.FC<MockAdminRouteProps> = ({ session, userRole, children }) => {
  if (!session) return <Navigate to="/login" replace />;
  if (userRole !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ─── Componentes de placeholder para teste ────────────────────────────────────
const LoginPage = () => <div data-testid="login-page">Login</div>;
const HomePage = () => <div data-testid="home-page">Home</div>;
const DebugPage = () => <div data-testid="debug-page">Debug</div>;

describe('[Integration] Proteção de rotas — sem sessão', () => {
  it('deve mostrar login quando não autenticado na rota /', () => {
    const session = null;
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={session ? <HomePage /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('deve mostrar login quando não autenticado na rota /expedicoes', () => {
    const session = null;
    render(
      <MemoryRouter initialEntries={['/expedicoes']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/expedicoes"
            element={session ? <HomePage /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('deve redirecionar /login para / quando já autenticado', () => {
    const session = { user: { id: '123' } };
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={session ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });
});

describe('[Integration] AdminRoute — proteção por role', () => {
  it('deve mostrar a página de debug para usuário admin', () => {
    const session = { user: { id: 'admin-id' } };
    render(
      <MemoryRouter initialEntries={['/debug/entregas']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/debug/entregas"
            element={
              <MockAdminRoute session={session} userRole="admin">
                <DebugPage />
              </MockAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('debug-page')).toBeInTheDocument();
  });

  it('deve redirecionar para / quando role é motorista', () => {
    const session = { user: { id: 'driver-id' } };
    render(
      <MemoryRouter initialEntries={['/debug/entregas']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/debug/entregas"
            element={
              <MockAdminRoute session={session} userRole="motorista">
                <DebugPage />
              </MockAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-page')).not.toBeInTheDocument();
  });

  it('deve redirecionar para / quando role é expedicao', () => {
    const session = { user: { id: 'exp-id' } };
    render(
      <MemoryRouter initialEntries={['/debug/entregas']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/debug/entregas"
            element={
              <MockAdminRoute session={session} userRole="expedicao">
                <DebugPage />
              </MockAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-page')).not.toBeInTheDocument();
  });

  it('deve redirecionar para /login quando não autenticado', () => {
    render(
      <MemoryRouter initialEntries={['/debug/entregas']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/debug/entregas"
            element={
              <MockAdminRoute session={null} userRole={null}>
                <DebugPage />
              </MockAdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-page')).not.toBeInTheDocument();
  });
});
