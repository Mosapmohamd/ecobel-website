'use client';

import { useEffect, useState } from 'react';
import { catalogApi, orderApi, type Order, type Product } from '@/lib/api';

export default function OrderEditor({
  order,
  token,
  onClose,
  onSaved,
}: {
  order: Order;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState(
    order.items.map((it) => ({ product_id: it.product_id, name: it.product_name, quantity: it.quantity }))
  );
  const [address, setAddress] = useState(order.shipping_address);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [addingProductId, setAddingProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi.products().then(setCatalog).catch(() => {});
  }, []);

  function setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.product_id !== productId));
      return;
    }
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, quantity } : l)));
  }

  function addProduct() {
    if (!addingProductId) return;
    if (lines.some((l) => l.product_id === addingProductId)) return;
    const product = catalog.find((p) => p.id === addingProductId);
    if (!product) return;
    setLines((prev) => [...prev, { product_id: product.id, name: product.name, quantity: 1 }]);
    setAddingProductId('');
  }

  async function handleSave() {
    if (lines.length === 0) {
      setError('الطلب لازم يحتوي على منتج واحد على الأقل — لو عايزة تلغي الطلب كامل استخدمي زرار الإلغاء');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await orderApi.edit(
        order.id,
        { items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })), shipping_address: address },
        token
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التعديل');
    } finally {
      setSaving(false);
    }
  }

  const availableToAdd = catalog.filter((p) => !lines.some((l) => l.product_id === p.id));

  return (
    <div className="rounded border p-4 mt-2" style={{ background: 'var(--parchment)', borderColor: 'var(--line)' }}>
      {error && (
        <div className="rounded p-3 mb-3 text-[13px]" style={{ background: 'rgba(186,26,26,0.08)', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {lines.map((l) => (
          <div key={l.product_id} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex-1">{l.name}</span>
            <div className="flex items-center border rounded" style={{ borderColor: 'var(--line)' }}>
              <button className="px-2" onClick={() => setQuantity(l.product_id, l.quantity - 1)}>−</button>
              <span className="px-3">{l.quantity}</span>
              <button className="px-2" onClick={() => setQuantity(l.product_id, l.quantity + 1)}>+</button>
            </div>
            <button onClick={() => setQuantity(l.product_id, 0)} style={{ color: 'var(--error)' }} aria-label="حذف">✕</button>
          </div>
        ))}
      </div>

      {availableToAdd.length > 0 && (
        <div className="flex gap-2 mb-4">
          <select
            value={addingProductId}
            onChange={(e) => setAddingProductId(e.target.value)}
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
          >
            <option value="">أضيفي منتج تاني...</option>
            {availableToAdd.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.sale_price.toLocaleString('ar-EG')} ج.م</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={addProduct} disabled={!addingProductId}>+ إضافة</button>
        </div>
      )}

      <div className="field mb-4">
        <label>عنوان التوصيل</label>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>إلغاء التعديل</button>
      </div>
    </div>
  );
}
