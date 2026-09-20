'use client';

import { useEffect, useState } from 'react';
import { adminApi, type Coupon } from '@/lib/api';

type LimitType = 'unlimited' | 'duration' | 'count';

export default function CouponsTab({ token }: { token: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('0');
  const [limitType, setLimitType] = useState<LimitType>('unlimited');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi.listCoupons(token).then(setCoupons).finally(() => setLoading(false));
  }
  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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
        limit_type: limitType,
        max_uses: limitType === 'count' ? Number(maxUses) || undefined : undefined,
        expires_at: limitType === 'duration' && expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCode('');
      setValue('');
      setMinOrder('0');
      setMaxUses('');
      setExpiresAt('');
      setLimitType('unlimited');
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الكوبون');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('متأكدة إنك عايزة تحذفي الكوبون ده؟')) return;
    await adminApi.deleteCoupon(token, id);
    load();
  }

  async function handleRenew(id: string) {
    await adminApi.renewCoupon(token, id);
    load();
  }

  function limitLabel(c: Coupon) {
    if (c.max_uses !== null) return `عدد: ${c.used_count}/${c.max_uses}`;
    if (c.expires_at) return `مدة: تنتهي ${new Date(c.expires_at).toLocaleDateString('ar-EG')}`;
    return 'غير محدود';
  }

  function isExhausted(c: Coupon) {
    if (c.max_uses !== null && c.used_count >= c.max_uses) return true;
    if (c.expires_at && new Date(c.expires_at) < new Date()) return true;
    return false;
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
              <label>نوع الخصم</label>
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
            <div className="field">
              <label>نوع التحديد</label>
              <select value={limitType} onChange={(e) => setLimitType(e.target.value as LimitType)}>
                <option value="unlimited">غير محدود</option>
                <option value="duration">محدد بمدة</option>
                <option value="count">محدد بعدد استخدامات</option>
              </select>
            </div>
            {limitType === 'count' && (
              <div className="field">
                <label>عدد مرات الاستخدام</label>
                <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} required />
              </div>
            )}
            {limitType === 'duration' && (
              <div className="field">
                <label>تاريخ الانتهاء</label>
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required />
              </div>
            )}
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
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>التحديد</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--line)', opacity: isExhausted(c) ? 0.55 : 1 }}>
                  <td className="p-3 font-bold" dir="ltr">{c.code}</td>
                  <td className="p-3">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ج.م`}</td>
                  <td className="p-3">{c.min_order_amount.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3">{limitLabel(c)}{isExhausted(c) && <span style={{ color: 'var(--rose)', fontSize: 11 }}> (منتهي)</span>}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {isExhausted(c) && (
                        <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => handleRenew(c.id)}>تجديد</button>
                      )}
                      <button className="btn" style={{ padding: '5px 10px', fontSize: 12.5, background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }} onClick={() => handleDelete(c.id)}>حذف</button>
                    </div>
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
