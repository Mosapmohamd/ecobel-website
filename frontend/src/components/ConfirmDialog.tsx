'use client';

import { useEffect, useId, useRef } from 'react';
import Icon, { type IconName } from './Icon';

/** In-site replacement for window.confirm/alert.
 *
 * Tones — pick by consequence, not by habit:
 * - `info`    — neutral notice; one "close" action is usually enough.
 * - `warning` — reversible but worth a pause (e.g. discarding unsaved edits).
 * - `danger`  — irreversible/destructive (e.g. cancelling an order). Focus
 *               lands on the safe action, never on the destructive one. */
export type DialogTone = 'info' | 'warning' | 'danger';

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Omit (or pass null) for a single-action informational dialog. */
  cancelLabel?: string | null;
  tone?: DialogTone;
  /** @deprecated use `tone="danger"` */
  destructive?: boolean;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const TONE: Record<DialogTone, { icon: IconName; color: string; bg: string }> = {
  info: { icon: 'info', color: 'var(--color-primary)', bg: 'var(--color-surface-muted)' },
  warning: { icon: 'alert', color: 'var(--color-primary-hover)', bg: 'var(--color-surface-muted)' },
  danger: { icon: 'alert', color: 'var(--color-error)', bg: 'color-mix(in srgb, var(--color-error) 9%, transparent)' },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'رجوع',
  tone: toneProp,
  destructive,
  busy,
  busyLabel = 'جاري التنفيذ...',
  error,
  onConfirm,
  onCancel,
}: Props) {
  const tone: DialogTone = toneProp ?? (destructive ? 'danger' : 'info');
  const t = TONE[tone];
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Latest callback/busy for the keydown handler, without re-running the
  // open effect (which would steal focus back on every render).
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  useEffect(() => {
    onCancelRef.current = onCancel;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    // Danger → focus the safe button so Enter can't destroy anything by accident.
    (safeRef.current ?? confirmRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep focus inside the dialog.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, textarea, select');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  const singleAction = !cancelLabel;

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        ref={panelRef}
        role={tone === 'info' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={message ? `${id}-msg` : undefined}
        className="dialog-panel w-full max-w-[420px] rounded border p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-none"
            style={{ background: t.bg, color: t.color }}
          >
            <Icon name={t.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={`${id}-title`} className="text-[22px] leading-tight">{title}</h2>
            {message && (
              <p id={`${id}-msg`} className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--color-ink-secondary)' }}>
                {message}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="notice notice-error mt-4">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          {!singleAction && (
            <button ref={safeRef} type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-sm ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
