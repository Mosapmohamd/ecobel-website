'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { accountApi, orderApi, type Order } from '@/lib/api';
import Link from 'next/link';
import OrderEditor from './OrderEditor';
import Icon, { type IconName } from '@/components/Icon';

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

const STATUS_STYLE: Record<Order['status'], { icon: IconName; bg: string; color: string }> = {
  pending: { icon: 'box', bg: 'var(--parchment-2)', color: 'var(--forest-deep)' },
  shipped: { icon: 'truck', bg: 'rgba(107,156,108,0.14)', color: '#3f6b40' },
  delivered: { icon: 'checkCircle', bg: 'rgba(107,156,108,0.14)', color: '#3f6b40' },
  cancelled: { icon: 'close', bg: 'rgba(186,26,26,0.08)', color: 'var(--error)' },
};

type Filter = 'all' | Order['status'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'قيد التجهيز' },
  { key: 'shipped', label: 'في الطريق' },
  { key: 'delivered', label: 'تم التوصيل' },
  { key: 'cancelled', label: 'ملغي' },
];

const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`;

export default function AccountPage() {
  const { customer, token, loading, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!loading && !customer) router.push('/account/login');
  }, [loading, customer, router]);

  function loadOrders() {
    if (token) {
      accountApi
        .myOrders(token)
        .then(setOrders)
        .catch(() => {})
        .finally(() => setLoadingOrders(false));
    }
  }
  useEffect(loadOrders, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel(orderId: string) {
    if (!token) return;
    if (!confirm('متأكدة إنك عايزة تلغي الطلب ده؟')) return;
    try {
      await orderApi.cancel(orderId, token);
      loadOrders();
    } catch {
      alert('تعذر إلغاء الطلب');
    }
  }

  if (loading || !customer) {
    return <div className="mx-auto max-w-4xl px-5 py-16" style={{ color: 'var(--muted)' }}>جاري التحميل...</div>;
  }

  const visibleOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const countFor = (f: Filter) => (f === 'all' ? orders.length : orders.filter((o) => o.status === f).length);

  return (
    <div>
      <section className="border-b" style={{ background: 'var(--parchment)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-10">
          <span className="kicker">حسابي</span>
          <h1 className="text-[30px] lg:text-[40px] leading-tight">أهلًا {customer.name.split(' ')[0]}</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: 'var(--muted)' }}>
            تابعي طلباتك وعدّلي الطلبات اللي لسه قيد التجهيز.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-24 flex flex-col gap-4">
          <div className="rounded border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] font-bold flex-none"
                style={{ background: 'var(--parchment-2)', color: 'var(--forest)', fontFamily: 'var(--font-display)' }}
              >
                {customer.name.trim().charAt(0)}
              </span>
              <h2 className="text-[20px] leading-tight">{customer.name}</h2>
            </div>
            <div className="flex flex-col gap-2 text-[13.5px]" style={{ color: 'var(--muted-strong)' }}>
              <span className="flex items-center gap-2"><Icon name="phone" size={15} /><span dir="ltr">{customer.phone}</span></span>
              {customer.email && <span className="flex items-center gap-2 break-all"><Icon name="mail" size={15} />{customer.email}</span>}
              {customer.address && <span className="flex items-start gap-2"><Icon name="pin" size={15} className="mt-0.5 flex-none" />{customer.address}</span>}
            </div>
          </div>

          <nav className="rounded border overflow-hidden text-[14px] font-medium" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
            <span className="flex items-center gap-2.5 px-5 py-3 border-r-2" style={{ background: 'var(--parchment)', color: 'var(--forest)', borderColor: 'var(--forest)' }}>
              <Icon name="box" size={18} />طلباتي
            </span>
            <Link href="/wishlist" className="flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--parchment)]" style={{ borderColor: 'var(--line)' }}>
              <Icon name="heart" size={18} />المفضلة
            </Link>
            <Link href="/track" className="flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--parchment)]" style={{ borderColor: 'var(--line)' }}>
              <Icon name="truck" size={18} />تتبع طلب
            </Link>
            <button
              className="w-full flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--parchment)]"
              style={{ borderColor: 'var(--line)', color: 'var(--error)' }}
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              <Icon name="logout" size={18} />تسجيل الخروج
            </button>
          </nav>
        </aside>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <h2 className="text-[26px] leading-tight">سجل الطلبات</h2>
              {!loadingOrders && (
                <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>{orders.length.toLocaleString('ar-EG')} طلب</p>
              )}
            </div>
          </div>

          {orders.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5">
              {FILTERS.filter((f) => f.key === 'all' || countFor(f.key) > 0).map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`h-9 px-3.5 rounded border text-[13px] font-bold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[var(--parchment)] border-[var(--forest)] text-[var(--forest)]'
                        : 'bg-white border-[var(--line)] text-[var(--muted-strong)] hover:border-[var(--forest)]'
                    }`}
                  >
                    {f.label} ({countFor(f.key).toLocaleString('ar-EG')})
                  </button>
                );
              })}
            </div>
          )}

          {loadingOrders ? (
            <p style={{ color: 'var(--muted)' }}>جاري التحميل...</p>
          ) : orders.length === 0 ? (
            <div className="rounded border p-10 text-center" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
              <p className="mb-5" style={{ color: 'var(--muted)' }}>لسه معملتيش أي طلب.</p>
              <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleOrders.map((o) => {
                const st = STATUS_STYLE[o.status];
                return (
                  <article key={o.id} className="rounded border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
                    <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--line)', background: 'var(--parchment)' }}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-bold text-[15px]">طلب رقم <span dir="ltr">#{o.order_number}</span></span>
                        <span className="badge inline-flex items-center gap-1" style={{ background: st.bg, color: st.color }}>
                          <Icon name={st.icon} size={13} />
                          {STATUS_LABEL[o.status]}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>إجمالي الطلب</div>
                        <div className="font-bold text-[17px]">{egp(o.total_amount)}</div>
                      </div>
                    </header>

                    <div className="px-5 py-4">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
                        <span>{new Date(o.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span>{o.payment_method === 'cash_on_delivery' ? 'الدفع عند الاستلام' : o.payment_method}</span>
                        {o.city && <span>{o.city}</span>}
                      </div>
                      <ul className="flex flex-col gap-1.5 text-[14px]">
                        {o.items.map((it) => (
                          <li key={it.product_id} className="flex justify-between gap-3">
                            <span>{it.product_name} <span style={{ color: 'var(--muted)' }}>× {it.quantity.toLocaleString('ar-EG')}</span></span>
                            <span className="flex-none" style={{ color: 'var(--muted-strong)' }}>{egp(it.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                      {o.shipping_address && (
                        <p className="mt-3 text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
                          <Icon name="pin" size={14} className="mt-0.5 flex-none" />
                          {o.shipping_address}
                        </p>
                      )}

                      {o.status === 'pending' && (
                        editingId === o.id ? (
                          token && (
                            <OrderEditor
                              order={o}
                              token={token}
                              onClose={() => setEditingId(null)}
                              onSaved={() => { setEditingId(null); loadOrders(); }}
                            />
                          )
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(o.id)}>
                              تعديل الطلب / العنوان
                            </button>
                            <button
                              className="btn btn-sm border-[var(--line)] text-[var(--error)] hover:bg-[rgba(186,26,26,0.06)]"
                              onClick={() => handleCancel(o.id)}
                            >
                              إلغاء الطلب
                            </button>
                          </div>
                        )
                      )}
                      {o.status === 'shipped' && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                          <Link
                            href={`/track?order_number=${o.order_number}&phone=${o.customer_phone}`}
                            className="btn btn-secondary btn-sm"
                          >
                            <Icon name="truck" size={16} />
                            تتبعي الشحنة
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
