'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { accountApi, ApiError, SESSION_EXPIRED_EVENT, type Customer } from './api';

/**
 * - `anonymous`     — no session.
 * - `loading`       — session found, profile being loaded.
 * - `authenticated` — profile loaded.
 * - `unverified`    — session kept, but the profile couldn't be loaded right
 *                     now (network down, timeout, server error). Only an
 *                     invalid session (401) signs the customer out.
 */
export type AuthStatus = 'anonymous' | 'loading' | 'authenticated' | 'unverified';

interface AuthContextValue {
  customer: Customer | null;
  token: string | null;
  status: AuthStatus;
  /** True until the session (if any) is resolved one way or the other. */
  loading: boolean;
  /** Why the profile couldn't be loaded (status `unverified`). */
  profileError: string | null;
  retryProfile: () => void;
  register: (payload: { name: string; phone: string; email?: string; address?: string; password: string }) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'ecobel_customer_token';

// The token lives in localStorage (raw string), read through
// useSyncExternalStore: no load-in-an-effect flash, synced across tabs.
const listeners = new Set<() => void>();
function readToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — the session just won't persist
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Only an invalid/expired session ends it; every other failure is temporary. */
function isInvalidSession(err: unknown): boolean {
  return err instanceof ApiError && err.kind === 'http' && err.status === 401;
}

type Profile = { token: string; customer: Customer | null; error: string | null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempt, setAttempt] = useState(0);

  const logout = useCallback(() => {
    writeToken(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    // The server render has no session; mark when the browser's is known.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    accountApi
      .me(token)
      .then((customer) => !cancelled && setProfile({ token, customer, error: null }))
      .catch((err) => {
        if (cancelled) return;
        if (isInvalidSession(err)) logout();
        else setProfile((prev) => ({
          token,
          // Keep a profile we already had for this session (e.g. a refresh failed).
          customer: prev?.token === token ? prev.customer : null,
          error: err instanceof Error ? err.message : 'تعذر تحميل بيانات حسابك',
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt, logout]);

  const current = profile && profile.token === token ? profile : null;
  const customer = current?.customer ?? null;
  const status: AuthStatus = !token
    ? hydrated ? 'anonymous' : 'loading'
    : customer ? 'authenticated' : current?.error ? 'unverified' : 'loading';

  async function signIn(accessToken: string) {
    // Keep the session even if the profile can't be loaded this second —
    // the account exists; the effect above retries/report as usual.
    writeToken(accessToken);
    try {
      const me = await accountApi.me(accessToken);
      setProfile({ token: accessToken, customer: me, error: null });
    } catch (err) {
      if (isInvalidSession(err)) throw err;
    }
  }

  async function register(payload: { name: string; phone: string; email?: string; address?: string; password: string }) {
    const res = await accountApi.register(payload);
    await signIn(res.access_token);
  }

  async function login(phone: string, password: string) {
    const res = await accountApi.login(phone, password);
    await signIn(res.access_token);
  }

  async function refresh() {
    if (token) setAttempt((n) => n + 1);
  }

  return (
    <AuthContext.Provider
      value={{
        customer,
        token,
        status,
        loading: status === 'loading',
        profileError: status === 'unverified' ? current?.error ?? null : null,
        retryProfile: () => setAttempt((n) => n + 1),
        register,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
