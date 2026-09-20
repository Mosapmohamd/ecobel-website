'use client';

import { useEffect, useState } from 'react';
import { adminApi, type Order } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};
const STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

export default function OrdersTab({ token }: { token: string }) {
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
      <div className="flex gap-2 mb-5 flex-wrap">
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
