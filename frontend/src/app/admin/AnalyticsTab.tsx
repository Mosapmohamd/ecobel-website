'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi, type SalesAnalytics } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

function money(n: number) {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 0 }) + ' ج.م';
}

export default function AnalyticsTab({ token }: { token: string }) {
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.analytics(token).then(setData).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ color: '#8a8074' }}>جاري التحميل...</div>;
  if (!data) return <div style={{ color: '#8a8074' }}>تعذر تحميل التحليلات.</div>;

  const chartData = data.revenue_last_30_days.map((p) => ({
    day: new Date(p.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' }),
    total: p.total,
  }));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
          <div className="text-[12.5px] font-bold" style={{ color: '#8a8074' }}>إجمالي الإيرادات</div>
          <div className="text-2xl font-extrabold mt-1" style={{ color: 'var(--forest)' }}>{money(data.total_revenue)}</div>
        </div>
        <div className="rounded-lg border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
          <div className="text-[12.5px] font-bold" style={{ color: '#8a8074' }}>إجمالي الطلبات</div>
          <div className="text-2xl font-extrabold mt-1" style={{ color: 'var(--forest)' }}>{data.total_orders}</div>
        </div>
        {Object.entries(data.orders_by_status).map(([status, count]) => (
          <div key={status} className="rounded-lg border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
            <div className="text-[12.5px] font-bold" style={{ color: '#8a8074' }}>{STATUS_LABEL[status] || status}</div>
            <div className="text-2xl font-extrabold mt-1" style={{ color: 'var(--forest)' }}>{count}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-5 mb-8" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        <h2 className="text-xl mb-4">الإيرادات — آخر 30 يوم</h2>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke="#8a8074" fontSize={11} />
              <YAxis stroke="#8a8074" fontSize={11} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Bar dataKey="total" fill="#c9a227" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-xl">الأكثر مبيعًا</h2>
        </div>
        {data.top_products.length === 0 ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>مفيش مبيعات لسه.</div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>المنتج</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>القطع المباعة</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {data.top_products.map((p) => (
                <tr key={p.product_name} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="p-3 font-bold">{p.product_name}</td>
                  <td className="p-3">{p.quantity_sold}</td>
                  <td className="p-3">{money(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
