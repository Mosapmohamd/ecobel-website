'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/staffAuth';
import { adminApi, type Order, type Coupon } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};
const STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

type Tab = 'orders' | 'coupons';

export default function AdminPage() {
  const { token, username, loading: authLoading, logout } = useStaffAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('orders');

  useEffect(() => {
    if (!authLoading && !token) router.push('/admin/login');
  }, [authLoading, token, router]);

  if (authLoading || !token) {
    return <div className="mx-auto max-w-6xl px-5 py-16" style={{ color: '#8a8074' }}>جاري التحميل...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl">لوحة التحكم</h1>
          <p className="text-[13px]" style={{ color: '#8a8074' }}>مسجّلة دخول كـ {username}</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            logout();
            router.push('/');
          }}
        >
          تسجيل خروج
        </button>
      </div>

      <div className="flex gap-2 mb-8">
        <button className="btn" onClick={() => setTab('orders')} style={{ background: tab === 'orders' ? 'var(--forest)' : 'var(--parchment-2)', color: tab === 'orders' ? 'var(--cream)' : 'var(--forest)' }}>
          الطلبات
        </button>
        <button className="btn" onClick={() => setTab('coupons')} style={{ background: tab === 'coupons' ? 'var(--forest)' : 'var(--parchment-2)', color: tab === 'coupons' ? 'var(--cream)' : 'var(--forest)' }}>
          الكوبونات
        </button>
      </div>

      {tab === 'orders' ? <OrdersTab token={token} /> : <CouponsTab token={token} />}
    </div>
  );
}

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi
      .listOrders(token, statusFilter || undefined)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'حصل خطأ'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(orderId: string, status: string) {
    try {
      await adminApi.updateOrderStatus(token, orderId, status);
      load();
    } catch {
      setError('تعذر تحديث حالة الطلب');
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button className="btn btn-secondary" onClick={() => setStatusFilter('')} style={{ opacity: statusFilter === '' ? 1 : 0.6 }}>الكل</button>
        {STATUSES.map((s) => (
          <button key={s} className="btn btn-secondary" onClick={() => setStatusFilter(s)} style={{ opacity: statusFilter === s ? 1 : 0.6 }}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md p-3 mb-4 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>{error}</div>}

      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        {loading ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>جاري التحميل...</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>مفيش طلبات.</div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>رقم الطلب</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>العميل</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الإجمالي</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الحالة</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>تحديث</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="p-3 font-bold">{o.order_number}</td>
                  <td className="p-3">{o.customer_name}<br /><span dir="ltr" style={{ color: '#8a8074', fontSize: 12 }}>{o.customer_phone}</span></td>
                  <td className="p-3">{o.total_amount.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3">{STATUS_LABEL[o.status]}</td>
                  <td className="p-3">
                    <select
                      value={o.status}
                      onChange={(e) => changeStatus(o.id, e.target.value)}
                      style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CouponsTab({ token }: { token: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi.listCoupons(token).then(setCoupons).finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.createCoupon(token, {
        code,
        discount_type: type,
        discount_value: Number(value) || 0,
        min_order_amount: Number(minOrder) || 0,
      });
      setCode('');
      setValue('');
      setMinOrder('0');
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الكوبون');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl">الكوبونات</h2>
        <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'إلغاء' : '+ كوبون جديد'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="rounded-lg border p-5 mb-5 flex flex-col gap-4" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
          {error && <div className="rounded-md p-3 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>الكود</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required dir="ltr" />
            </div>
            <div className="field">
              <label>النوع</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}>
                <option value="percentage">نسبة %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            <div className="field">
              <label>القيمة</label>
              <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div className="field">
              <label>الحد الأدنى للطلب (ج.م)</label>
              <input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ الكوبون'}</button>
        </form>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        {loading ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>جاري التحميل...</div>
        ) : coupons.length === 0 ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>مفيش كوبونات لسه.</div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الكود</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الخصم</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الحد الأدنى</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>مرات الاستخدام</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="p-3 font-bold" dir="ltr">{c.code}</td>
                  <td className="p-3">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ج.م`}</td>
                  <td className="p-3">{c.min_order_amount.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
