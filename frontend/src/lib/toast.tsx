'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';

/** Lightweight, non-blocking confirmations for low-stakes actions (added
 * to cart, removed with undo). Anything irreversible uses ConfirmDialog
 * instead — a toast must never be the only guard on a destructive action. */
type ToastTone = 'success' | 'info' | 'error';
type ToastAction = { label: string; onClick: () => void } | { label: string; href: string };

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (message: string, opts?: { tone?: ToastTone; action?: ToastAction; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ToastContextValue['show']>(
    (message, opts) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, tone: opts?.tone ?? 'success', action: opts?.action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), opts?.duration ?? DEFAULT_DURATION));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed z-[70] bottom-4 inset-x-4 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:w-[380px] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="toast pointer-events-auto flex items-center gap-3 rounded border px-4 py-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
          >
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full flex items-center justify-center flex-none"
              style={{
                background: t.tone === 'error' ? 'color-mix(in srgb, var(--color-error) 9%, transparent)' : 'var(--color-surface-tint)',
                color: t.tone === 'error' ? 'var(--color-error)' : t.tone === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            >
              <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'success' ? 'check' : 'info'} size={15} strokeWidth={2.2} />
            </span>
            <span className="flex-1 text-[14px] font-medium" style={{ color: 'var(--color-ink)' }}>{t.message}</span>
            {t.action &&
              ('href' in t.action ? (
                <Link
                  href={t.action.href}
                  onClick={() => dismiss(t.id)}
                  className="flex-none text-[13.5px] font-bold link-underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t.action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    (t.action as { onClick: () => void }).onClick();
                    dismiss(t.id);
                  }}
                  className="flex-none text-[13.5px] font-bold link-underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t.action.label}
                </button>
              ))}
            <button
              type="button"
              aria-label="إغلاق التنبيه"
              onClick={() => dismiss(t.id)}
              className="flex-none -my-1 -ml-1 w-8 h-8 flex items-center justify-center rounded transition-colors text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
