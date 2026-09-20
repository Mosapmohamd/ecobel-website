'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/staffAuth';
import AnalyticsTab from './AnalyticsTab';
import OrdersTab from './OrdersTab';
import ProductsTab from './ProductsTab';
import CouponsTab from './CouponsTab';

type Tab = 'analytics' | 'orders' | 'products' | 'coupons';

const TABS: { key: Tab; label: string }[] = [
  { key: 'analytics', label: 'تحليلات المبيعات' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'products', label: 'المنتجات والفئات' },
  { key: 'coupons', label: 'الكوبونات' },
];

export default function AdminPage() {
  const { token, username, loading: authLoading, logout } = useStaffAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('analytics');

  useEffect(() => {
    if (!authLoading && !token) router.push('/account/login');
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

      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            className="btn"
            onClick={() => setTab(t.key)}
            style={{ background: tab === t.key ? 'var(--forest)' : 'var(--parchment-2)', color: tab === t.key ? 'var(--cream)' : 'var(--forest)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsTab token={token} />}
      {tab === 'orders' && <OrdersTab token={token} />}
      {tab === 'products' && <ProductsTab token={token} />}
      {tab === 'coupons' && <CouponsTab token={token} />}
    </div>
  );
}
