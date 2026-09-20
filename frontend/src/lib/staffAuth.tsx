'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { staffApi } from './api';

interface StaffAuthContextValue {
  token: string | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null);
const TOKEN_KEY = 'ecobel_staff_token';
const USERNAME_KEY = 'ecobel_staff_username';

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setUsername(localStorage.getItem(USERNAME_KEY));
    setLoading(false);
  }, []);

  async function login(u: string, p: string) {
    const res = await staffApi.login(u, p);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USERNAME_KEY, u);
    setToken(res.access_token);
    setUsername(u);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
  }

  return (
    <StaffAuthContext.Provider value={{ token, username, loading, login, logout }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
}
