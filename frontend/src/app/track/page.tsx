'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { orderApi, type Order, type OrderTrackSummary } from '@/lib/api';
import { egp } from '@/lib/constants';
import OrderStatusBadge, { OrderTotals } from '@/components/OrderStatusBadge';

function isFullOrder(r: Order | OrderTrackSummary): r is Order {
  return 'items' in r;
}

interface Search {
  orderNumber: string;
  phone: string;
  /** Bumped on every submit, so searching the same values again re-runs it. */
  attempt: number;
}

type Outcome = { search: Search; results: (Order | OrderTrackSummary)[] | null; error: string | null };

function TrackContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order_number') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  // Arriving with ?order_number=…&phone=… (e.g. from the order confirmation)
  // searches straight away.
  const [search, setSearch] = useState<Search | null>(() =>
    orderNumber || phone ? { orderNumber, phone, attempt: 0 } : null,
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!search) return;
    let cancelled = false;
    orderApi
      .track({ orderNumber: search.orderNumber.trim() || undefined, phone: search.phone.trim() || undefined })
      .then((r) => !cancelled && setOutcome({ search, results: Array.isArray(r) ? r : [r], error: null }))
      .catch((err) => !cancelled && setOutcome({ search, results: null, error: err instanceof Error ? err.message : 'تعذر إيجاد الطلب' }));
    return () => {
      cancelled = true;
    };
  }, [search]);

  const current = outcome && outcome.search === search ? outcome : null;
  const loading = search !== null && current === null;
  const error = formError ?? current?.error ?? null;
  const results = current?.results ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() && !phone.trim()) {
      setFormError('اكتبي رقم الطلب أو رقم التليفون على الأقل');
      return;
    }
    setFormError(null);
    setSearch((prev) => ({ orderNumber, phone, attempt: (prev?.attempt ?? 0) + 1 }));
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      <span className="kicker">تتبع الطلبات</span>
      <h1 className="text-[30px] lg:text-[36px] leading-tight mb-2">تتبعي طلبك</h1>
      <p style={{ color: 'var(--color-ink-muted)' }} className="mb-8">
        اكتبي رقم الطلب أو رقم التليفون — مش شرط الاتنين. تفاصيل الطلب كاملة (زي العنوان) بتظهر بس
        لو كتبتي الاتنين مع بعض.
      </p>

      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
        <div className="field">
          <label htmlFor="track-order">رقم الطلب (اختياري)</label>
          <input id="track-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="مثال: EB123456" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="track-phone">رقم التليفون (اختياري)</label>
          <input id="track-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري البحث...' : 'تتبّع'}</button>
      </form>

      {error && (
        <div role="alert" className="notice notice-error mt-6">
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-4 mt-8">
          {results.map((r) => (
            <div key={r.order_number} className="rounded border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
              <div className="flex justify-between items-center gap-3 mb-3">
                <div className="font-bold text-lg">طلب <span dir="ltr">#{r.order_number}</span></div>
                <OrderStatusBadge status={r.status} />
              </div>

              {isFullOrder(r) ? (
                <>
                  <ul className="flex flex-col gap-2 text-[13.5px] mb-4">
                    {r.items.map((it) => (
                      <li key={it.product_id} className="flex justify-between gap-3">
                        <span>{it.product_name} <span className="text-ink-muted">× {it.quantity.toLocaleString('ar-EG')}</span></span>
                        <span className="flex-none">{egp(it.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-line pt-3">
                    <OrderTotals order={r} />
                  </div>
                  <div className="mt-4 pt-4 border-t text-[13px]" style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-muted)' }}>
                    <div>عنوان التوصيل: {r.city ? `${r.city} — ` : ''}{r.shipping_address}</div>
                  </div>
                </>
              ) : (
                <div className="text-[13.5px] flex justify-between" style={{ color: 'var(--color-ink-muted)' }}>
                  <span>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{egp(r.total_amount)}</span>
                </div>
              )}
            </div>
          ))}
          {!isFullOrder(results[0]) && (
            <p className="text-[12.5px] text-center" style={{ color: 'var(--color-ink-muted)' }}>
              اكتبي رقم الطلب ورقم التليفون سوا عشان تشوفي التفاصيل كاملة (العنوان والمنتجات).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl px-5 py-14">جاري التحميل...</div>}>
      <TrackContent />
    </Suspense>
  );
}
