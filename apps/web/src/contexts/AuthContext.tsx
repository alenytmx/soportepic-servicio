import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, jsonBody } from '../lib/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setupRequired: boolean;
  systemError: string | null;
  login(username: string, password: string): Promise<void>;
  setup(data: { name: string; username: string; password: string; businessName: string }): Promise<void>;
  logout(): Promise<void>;
  refresh(silent?: boolean): Promise<void>;
  can(permission: string): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const status = await api<{ setupRequired: boolean }>('/auth/setup-status');
      setSystemError(null);
      setSetupRequired(status.setupRequired);
      if (!status.setupRequired) {
        try {
          const response = await api<{ user: User }>('/auth/me');
          setUser(response.user);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) setUser(null);
          else throw error;
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      if (!silent) setUser(null);
      setSystemError(error instanceof Error ? error.message : 'No fue posible conectar con la API.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!systemError) return;
    const retry = window.setInterval(() => void refresh(true), 3_000);
    return () => window.clearInterval(retry);
  }, [refresh, systemError]);

  const login = async (username: string, password: string) => {
    const response = await api<{ user: User }>('/auth/login', { method: 'POST', ...jsonBody({ username, password }) });
    setUser(response.user);
    setSetupRequired(false);
  };

  const setup = async (data: { name: string; username: string; password: string; businessName: string }) => {
    const response = await api<{ user: User }>('/auth/setup-admin', { method: 'POST', ...jsonBody(data) });
    setUser(response.user);
    setSetupRequired(false);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    setupRequired,
    systemError,
    login,
    setup,
    logout,
    refresh,
    can: (permission) => Boolean(user && (user.role === 'admin' || user.permissions.includes(permission)))
  }), [user, loading, setupRequired, systemError, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
