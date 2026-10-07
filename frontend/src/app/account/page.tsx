'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { accountApi, orderApi, type Order } from '@/lib/api';
import Link from 'next/link';
import OrderEditor from './OrderEditor';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import OrderStatusBadge, { ORDER_STATUS_LABEL, OrderTotals } from '@/components/OrderStatusBadge';
import { useToast } from '@/lib/toast';
import { egp } from '@/lib/constants';

type Filter = 'all' | Order['status'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  ...(['pending', 'shipped', 'delivered', 'cancelled'] as const).map((key) => ({ key, label: ORDER_STATUS_LABEL[key] })),
];

export default function AccountPage() {
  const { customer, token, status, profileError, retryProfile, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Only a missing/invalid session sends the customer to sign in — a
  // profile that couldn't load right now (network) offers a retry instead.
  useEffect(() => {
    if (status === 'anonymous') router.push('/account/login');
  }, [status, router]);

  function loadOrders() {
    if (token) {
      accountApi
        .myOrders(token)
        .then((list) => {
          setOrders(list);
          setOrdersError(null);
        })
        .catch((err) => setOrdersError(err instanceof Error ? err.message : 'تعذر تحميل طلباتك'))
        .finally(() => setLoadingOrders(false));
    }
  }
  useEffect(loadOrders, [token]);

  async function confirmCancel() {
    if (!token || !cancelId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await orderApi.cancel(cancelId, token);
      setCancelId(null);
      loadOrders();
      toast.show('تم إلغاء الطلب');
    } catch (err) {
      // Backend explains *why* (e.g. already shipped) — show that, not a generic line.
      setCancelError(err instanceof Error ? err.message : 'تعذر إلغاء الطلب، حاولي تاني.');
    } finally {
      setCancelling(false);
    }
  }

  const closeCancelDialog = useCallback(() => {
    setCancelId(null);
    setCancelError(null);
  }, []);

  if (status === 'unverified') {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div role="alert" className="notice notice-error flex flex-wrap items-center justify-between gap-3">
          <span>{profileError ?? 'تعذر تحميل بيانات حسابك'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retryProfile}>حاولي تاني</button>
        </div>
      </div>
    );
  }
  if (!customer) {
    return <div className="mx-auto max-w-4xl px-5 py-16" role="status" style={{ color: 'var(--color-ink-muted)' }}>جاري التحميل...</div>;
  }

  const visibleOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const countFor = (f: Filter) => (f === 'all' ? orders.length : orders.filter((o) => o.status === f).length);

  return (
    <div>
      <section className="border-b" style={{ background: 'var(--color-surface-tint)', borderColor: 'var(--color-line)' }}>
        <div className="page-container py-10">
          <span className="kicker">حسابي</span>
          <h1 className="text-[30px] lg:text-[40px] leading-tight">أهلًا {customer.name.split(' ')[0]}</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: 'var(--color-ink-muted)' }}>
            تابعي طلباتك وعدّلي الطلبات اللي لسه قيد التجهيز.
          </p>
        </div>
      </section>

      <div className="page-container py-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-24 flex flex-col gap-4">
          <div className="rounded border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-[22px] font-bold flex-none"
                style={{ background: 'var(--color-surface-muted)', color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}
              >
                {customer.name.trim().charAt(0)}
              </span>
              <h2 className="text-[20px] leading-tight">{customer.name}</h2>
            </div>
            <div className="flex flex-col gap-2 text-[13.5px]" style={{ color: 'var(--color-ink-secondary)' }}>
              <span className="flex items-center gap-2"><Icon name="phone" size={15} /><span dir="ltr">{customer.phone}</span></span>
              {customer.email && <span className="flex items-center gap-2 break-all"><Icon name="mail" size={15} />{customer.email}</span>}
              {customer.address && <span className="flex items-start gap-2"><Icon name="pin" size={15} className="mt-0.5 flex-none" />{customer.address}</span>}
            </div>
          </div>

          <nav className="rounded border overflow-hidden text-[14px] font-medium" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
            <span className="flex items-center gap-2.5 px-5 py-3 border-r-2" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
              <Icon name="box" size={18} />طلباتي
            </span>
            <Link href="/wishlist" className="flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--color-surface-tint)]" style={{ borderColor: 'var(--color-line)' }}>
              <Icon name="heart" size={18} />المفضلة
            </Link>
            <Link href="/track" className="flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--color-surface-tint)]" style={{ borderColor: 'var(--color-line)' }}>
              <Icon name="truck" size={18} />تتبع طلب
            </Link>
            <button
              className="w-full flex items-center gap-2.5 px-5 py-3 border-t transition-colors hover:bg-[var(--color-surface-tint)]"
              style={{ borderColor: 'var(--color-line)', color: 'var(--color-error)' }}
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
                <p className="text-[13px] mt-1" style={{ color: 'var(--color-ink-muted)' }}>{orders.length.toLocaleString('ar-EG')} طلب</p>
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
                        ? 'bg-[var(--color-surface-tint)] border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'bg-white border-[var(--color-line)] text-[var(--color-ink-secondary)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    {f.label} ({countFor(f.key).toLocaleString('ar-EG')})
                  </button>
                );
              })}
            </div>
          )}

          {loadingOrders ? (
            <p role="status" style={{ color: 'var(--color-ink-muted)' }}>جاري تحميل طلباتك...</p>
          ) : ordersError ? (
            <div role="alert" className="notice notice-error flex flex-wrap items-center justify-between gap-3">
              <span>{ordersError}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoadingOrders(true); setOrdersError(null); loadOrders(); }}>
                حاولي تاني
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded border p-10 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
              <p className="mb-5" style={{ color: 'var(--color-ink-muted)' }}>لسه معملتيش أي طلب.</p>
              <Link href="/products" className="btn btn-primary">تسوقي الآن</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleOrders.map((o) => {
                return (
                  <article key={o.id} className="rounded border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}>
                    <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface-tint)' }}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-bold text-[15px]">طلب رقم <span dir="ltr">#{o.order_number}</span></span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <div className="text-left">
                        <div className="text-[11.5px]" style={{ color: 'var(--color-ink-muted)' }}>إجمالي الطلب</div>
                        <div className="font-bold text-[17px]">{egp(o.total_amount)}</div>
                      </div>
                    </header>

                    <div className="px-5 py-4">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] mb-3" style={{ color: 'var(--color-ink-muted)' }}>
                        <span>{new Date(o.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span>{o.payment_method === 'cash_on_delivery' ? 'الدفع عند الاستلام' : o.payment_method}</span>
                        {o.city && <span>{o.city}</span>}
                      </div>
                      <ul className="flex flex-col gap-1.5 text-[14px]">
                        {o.items.map((it) => (
                          <li key={it.product_id} className="flex justify-between gap-3">
                            <span>{it.product_name} <span style={{ color: 'var(--color-ink-muted)' }}>× {it.quantity.toLocaleString('ar-EG')}</span></span>
                            <span className="flex-none" style={{ color: 'var(--color-ink-secondary)' }}>{egp(it.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 pt-3 border-t border-line sm:max-w-[320px] sm:mr-auto">
                        <OrderTotals order={o} />
                      </div>
                      {o.shipping_address && (
                        <p className="mt-3 text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--color-ink-muted)' }}>
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
                              onSaved={() => { setEditingId(null); loadOrders(); toast.show('تم حفظ تعديلات الطلب'); }}
                            />
                          )
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-line)' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(o.id)}>
                              تعديل الطلب / العنوان
                            </button>
                            <button
                              className="btn btn-sm border-line text-error hover:bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]"
                              onClick={() => setCancelId(o.id)}
                            >
                              إلغاء الطلب
                            </button>
                          </div>
                        )
                      )}
                      {o.status === 'shipped' && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-line)' }}>
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

      <ConfirmDialog
        open={cancelId !== null}
        title="إلغاء الطلب"
        message="متأكدة إنك عايزة تلغي الطلب ده؟ مش هتقدري ترجعي فيه بعد كده."
        confirmLabel="أيوه، الغي الطلب"
        cancelLabel="لا، رجوع"
        tone="danger"
        busy={cancelling}
        busyLabel="جاري إلغاء الطلب..."

        error={cancelError}
        onConfirm={confirmCancel}
        onCancel={closeCancelDialog}
      />
    </div>
  );
}
