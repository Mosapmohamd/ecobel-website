'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { orderApi, type Order, type OrderTrackSummary } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

function isFullOrder(r: Order | OrderTrackSummary): r is Order {
  return 'items' in r;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="badge"
      style={{
        background: status === 'delivered' ? 'rgba(91,140,90,0.14)' : status === 'cancelled' ? 'rgba(179,38,30,0.18)' : 'rgba(201,162,39,0.16)',
        color: status === 'delivered' ? 'var(--ok)' : status === 'cancelled' ? 'var(--error)' : '#9c7a14',
      }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function TrackContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order_number') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [results, setResults] = useState<(Order | OrderTrackSummary)[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSearch(on: string, ph: string) {
    setError(null);
    setLoading(true);
    setResults(null);
    try {
      const result = await orderApi.track({ orderNumber: on.trim() || undefined, phone: ph.trim() || undefined });
      setResults(Array.isArray(result) ? result : [result]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إيجاد الطلب');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() && !phone.trim()) {
      setError('اكتبي رقم الطلب أو رقم التليفون على الأقل');
      return;
    }
    runSearch(orderNumber, phone);
  }

  useEffect(() => {
    const on = searchParams.get('order_number');
    const ph = searchParams.get('phone');
    if (on || ph) runSearch(on || '', ph || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      <h1 className="text-3xl mb-2">تتبعي طلبك</h1>
      <p style={{ color: 'var(--muted)' }} className="mb-8">
        اكتبي رقم الطلب أو رقم التليفون — مش شرط الاتنين. تفاصيل الطلب كاملة (زي العنوان) بتظهر بس
        لو كتبتي الاتنين مع بعض.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="field">
          <label>رقم الطلب (اختياري)</label>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="مثال: EB123456" dir="ltr" />
        </div>
        <div className="field">
          <label>رقم التليفون (اختياري)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري البحث...' : 'تتبّع'}</button>
      </form>

      {error && (
        <div className="rounded p-3 mt-6 text-[13.5px]" style={{ background: 'rgba(179,38,30,0.15)', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-4 mt-8">
          {results.map((r) => (
            <div key={r.order_number} className="rounded border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
              <div className="flex justify-between items-center mb-3">
                <div className="font-bold text-lg">طلب #{r.order_number}</div>
                <StatusBadge status={r.status} />
              </div>

              {isFullOrder(r) ? (
                <>
                  <div className="flex flex-col gap-2 text-[13.5px] mb-4">
                    {r.items.map((it) => (
                      <div key={it.product_id} className="flex justify-between">
                        <span>{it.product_name} × {it.quantity}</span>
                        <span>{it.line_total.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-3 text-[14px] flex justify-between font-extrabold" style={{ borderColor: 'var(--line)', color: 'var(--forest)' }}>
                    <span>الإجمالي</span><span>{r.total_amount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="mt-4 pt-4 border-t text-[13px]" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    <div>عنوان التوصيل: {r.shipping_address}</div>
                  </div>
                </>
              ) : (
                <div className="text-[13.5px] flex justify-between" style={{ color: 'var(--muted)' }}>
                  <span>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                  <span className="font-bold" style={{ color: 'var(--forest)' }}>{r.total_amount.toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}
            </div>
          ))}
          {!isFullOrder(results[0]) && (
            <p className="text-[12.5px] text-center" style={{ color: 'var(--muted)' }}>
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
