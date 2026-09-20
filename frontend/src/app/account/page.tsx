'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { accountApi, type Order } from '@/lib/api';

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

export default function AccountPage() {
  const { customer, token, loading, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !customer) router.push('/account/login');
  }, [loading, customer, router]);

  useEffect(() => {
    if (token) {
      accountApi
        .myOrders(token)
        .then(setOrders)
        .catch(() => {})
        .finally(() => setLoadingOrders(false));
    }
  }, [token]);

  if (loading || !customer) {
    return <div className="mx-auto max-w-4xl px-5 py-16" style={{ color: '#8a8074' }}>جاري التحميل...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl">حسابي</h1>
        <button
          className="btn btn-secondary"
          onClick={() => {
            logout();
            router.push('/');
          }}
        >
          تسجيل الخروج
        </button>
      </div>

      <div className="rounded-lg border p-5 mb-10" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        <h2 className="text-xl mb-4">بياناتي</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
          <div><span style={{ color: '#8a8074' }}>الاسم: </span>{customer.name}</div>
          <div dir="ltr" className="text-right"><span style={{ color: '#8a8074' }}>التليفون: </span>{customer.phone}</div>
          <div><span style={{ color: '#8a8074' }}>البريد الإلكتروني: </span>{customer.email || '—'}</div>
          <div><span style={{ color: '#8a8074' }}>العنوان: </span>{customer.address || '—'}</div>
        </div>
      </div>

      <h2 className="text-xl mb-4">طلباتي</h2>
      {loadingOrders ? (
        <p style={{ color: '#8a8074' }}>جاري التحميل...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: '#8a8074' }}>لسه معملتيش أي طلب.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border p-4" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">طلب #{o.order_number}</span>
                <span
                  className="badge"
                  style={{
                    background: o.status === 'delivered' ? 'rgba(91,140,90,0.14)' : o.status === 'cancelled' ? 'rgba(201,123,138,0.18)' : 'rgba(201,162,39,0.16)',
                    color: o.status === 'delivered' ? 'var(--ok)' : o.status === 'cancelled' ? 'var(--rose)' : '#9c7a14',
                  }}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <div className="text-[13px]" style={{ color: '#8a8074' }}>
                {new Date(o.created_at).toLocaleDateString('ar-EG')} · {o.items.length} صنف · {o.total_amount.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
