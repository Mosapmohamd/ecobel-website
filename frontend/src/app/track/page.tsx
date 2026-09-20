'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { orderApi, type Order } from '@/lib/api';

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

function TrackContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order_number') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setOrder(null);
    try {
      const result = await orderApi.track(orderNumber.trim(), phone.trim());
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إيجاد الطلب');
    } finally {
      setLoading(false);
    }
  }

  // Auto-lookup if both came prefilled via the URL (post-checkout link).
  useEffect(() => {
    if (searchParams.get('order_number') && searchParams.get('phone')) {
      orderApi
        .track(searchParams.get('order_number')!, searchParams.get('phone')!)
        .then(setOrder)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      <h1 className="text-3xl mb-2">تتبعي طلبك</h1>
      <p style={{ color: '#8a8074' }} className="mb-8">أدخلي رقم الطلب ورقم التليفون اللي طلبتي بيه.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="field">
          <label>رقم الطلب</label>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="مثال: EB123456" required dir="ltr" />
        </div>
        <div className="field">
          <label>رقم التليفون</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" />
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'جاري البحث...' : 'تتبّع'}</button>
      </form>

      {error && (
        <div className="rounded-md p-3 mt-6 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>
          {error}
        </div>
      )}

      {order && (
        <div className="rounded-lg border p-5 mt-8" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="font-bold text-lg">طلب #{order.order_number}</div>
            <span
              className="badge"
              style={{
                background: order.status === 'delivered' ? 'rgba(91,140,90,0.14)' : order.status === 'cancelled' ? 'rgba(201,123,138,0.18)' : 'rgba(201,162,39,0.16)',
                color: order.status === 'delivered' ? 'var(--ok)' : order.status === 'cancelled' ? 'var(--rose)' : '#9c7a14',
              }}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>

          <div className="flex flex-col gap-2 text-[13.5px] mb-4">
            {order.items.map((it) => (
              <div key={it.product_id} className="flex justify-between">
                <span>{it.product_name} × {it.quantity}</span>
                <span>{it.line_total.toLocaleString('ar-EG')} ج.م</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 text-[14px] flex justify-between font-extrabold" style={{ borderColor: 'var(--line)', color: 'var(--forest)' }}>
            <span>الإجمالي</span><span>{order.total_amount.toLocaleString('ar-EG')} ج.م</span>
          </div>

          <div className="mt-4 pt-4 border-t text-[13px]" style={{ borderColor: 'var(--line)', color: '#8a8074' }}>
            <div>عنوان التوصيل: {order.shipping_address}</div>
          </div>
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
