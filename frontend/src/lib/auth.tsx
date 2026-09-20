'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { accountApi, type Customer } from './api';

interface AuthContextValue {
  customer: Customer | null;
  token: string | null;
  loading: boolean;
  register: (payload: { name: string; phone: string; email?: string; address?: string; password: string }) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'ecobel_customer_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe(t: string) {
    try {
      const me = await accountApi.me(t);
      setCustomer(me);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setCustomer(null);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
      loadMe(stored).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function register(payload: { name: string; phone: string; email?: string; address?: string; password: string }) {
    const res = await accountApi.register(payload);
    localStorage.setItem(STORAGE_KEY, res.access_token);
    setToken(res.access_token);
    await loadMe(res.access_token);
  }

  async function login(phone: string, password: string) {
    const res = await accountApi.login(phone, password);
    localStorage.setItem(STORAGE_KEY, res.access_token);
    setToken(res.access_token);
    await loadMe(res.access_token);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setCustomer(null);
  }

  async function refresh() {
    if (token) await loadMe(token);
  }

  return (
    <AuthContext.Provider value={{ customer, token, loading, register, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
