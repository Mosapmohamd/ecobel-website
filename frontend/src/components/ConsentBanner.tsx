'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { consent, OPEN_PRIVACY_PREFERENCES, useConsent } from '@/lib/analytics';

/** Opt-in choice for Meta ad tracking (lib/consent.ts). Rendered only when a
 * Pixel ID is configured (root layout). Shown until the visitor decides;
 * "accept" and "reject" are equal choices, nothing is preselected, the site
 * works the same either way, and the footer's «إعدادات الخصوصية» reopens it
 * to change the choice at any time. */
export default function ConsentBanner() {
  const choice = useConsent();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState(false);
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => {
      setDraft(consent.get()?.marketing === true); // the current choice; unchecked if none
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_PRIVACY_PREFERENCES, open);
    return () => window.removeEventListener(OPEN_PRIVACY_PREFERENCES, open);
  }, []);

  useEffect(() => {
    if (prefsOpen) panelRef.current?.focus();
  }, [prefsOpen]);

  if (choice === undefined) return null; // server render / before hydration
  if (choice !== null && !prefsOpen) return null; // decided, preferences closed

  function decide(marketing: boolean) {
    consent.set(marketing);
    setPrefsOpen(false);
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-labelledby={`${id}-title`}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface shadow-lg outline-none"
    >
      <div className="page-container py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex-1 min-w-0">
          <h2 id={`${id}-title`} className="text-body font-bold text-ink">الخصوصية وتتبع الإعلانات</h2>
          <p className="mt-1 text-body-sm text-ink-muted leading-relaxed">
            بنحب نستخدم أداة Meta (فيسبوك وإنستجرام) عشان نقيس إعلاناتنا — زي الصفحات اللي اتفتحت والمنتجات اللي اتضافت للسلة.
            ده بيحصل بس لو وافقتي، والموقع بيشتغل عادي لو رفضتي.{' '}
            <Link href="/privacy" className="underline text-ink">التفاصيل في سياسة الخصوصية</Link>
          </p>
          {prefsOpen && (
            <label className="mt-3 flex items-start gap-2 text-body-sm text-ink">
              <input type="checkbox" className="mt-1" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              <span>
                <strong>تتبع إعلانات Meta</strong> — اختياري. من غيره مفيش أي بيانات بتتبعت لـ Meta.
              </span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2 flex-none">
          {prefsOpen ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => decide(draft)}>حفظ الاختيار</button>
              {choice !== null && (
                <button type="button" className="btn btn-secondary" onClick={() => setPrefsOpen(false)}>إلغاء</button>
              )}
            </>
          ) : (
            <>
              {/* Equal choices: same style, neither preselected. */}
              <button type="button" className="btn btn-secondary" onClick={() => decide(true)}>موافقة</button>
              <button type="button" className="btn btn-secondary" onClick={() => decide(false)}>رفض</button>
              <button type="button" className="px-2 text-body-sm text-ink underline" onClick={() => { setDraft(false); setPrefsOpen(true); }}>
                الإعدادات
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the choice. */
export function PrivacyPreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_PRIVACY_PREFERENCES))}>
      إعدادات الخصوصية
    </button>
  );
}
