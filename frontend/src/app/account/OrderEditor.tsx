'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { catalogApi, orderApi, type Order, type Product } from '@/lib/api';
import { egp } from '@/lib/constants';
import ConfirmDialog from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';

const MAX_LINE_QUANTITY = 100;

/** Finds products to add by name (server-side search over the whole
 * catalog — not a capped list). */
function ProductSearch({ exclude, onPick }: { exclude: string[]; onPick: (p: Product) => void }) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ q: string; items: Product[] | null; error: boolean } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      catalogApi
        .products({ q, limit: 8 })
        .then((page) => !cancelled && setFound({ q, items: page.items, error: false }))
        .catch(() => !cancelled && setFound({ q, items: null, error: true }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const current = q.length >= 2 && found?.q === q ? found : null;
  const results = current?.items?.filter((p) => !exclude.includes(p.id)) ?? [];

  return (
    <div className="mb-4">
      <label htmlFor={`${uid}-search`} className="block text-[13px] font-bold mb-1.5">أضيفي منتج للطلب</label>
      <input
        id={`${uid}-search`}
        type="search"
        className="input w-full !py-2 !text-[13.5px]"
        placeholder="اكتبي اسم المنتج..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {q.length >= 2 && (
        <div className="mt-2" aria-live="polite">
          {!current ? (
            <p className="text-[12.5px] text-ink-muted">جاري البحث...</p>
          ) : current.error ? (
            <p role="alert" className="text-[12.5px] text-error">تعذر البحث دلوقتي، حاولي تاني.</p>
          ) : results.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">مفيش منتجات مطابقة.</p>
          ) : (
            <ul className="flex flex-col rounded border bg-white divide-y" style={{ borderColor: 'var(--color-line)' }}>
              {results.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    <span className="text-[12px] text-ink-muted">{p.max_quantity > 0 ? egp(p.price) : 'نفد من المخزون'}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex-none"
                    disabled={p.max_quantity === 0}
                    onClick={() => {
                      onPick(p);
                      setQuery('');
                    }}
                  >
                    <Icon name="plus" size={14} />
                    إضافة
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [city, setCity] = useState(order.city ?? '');
  const [address, setAddress] = useState(order.shipping_address);
  const [rates, setRates] = useState<{ city: string; fee: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const uid = useId();

  useEffect(() => {
    catalogApi.shippingRates().then(setRates).catch(() => setRates([]));
  }, []);

  const dirty =
    city !== (order.city ?? '') ||
    address !== order.shipping_address ||
    lines.length !== order.items.length ||
    lines.some((l) => order.items.find((it) => it.product_id === l.product_id)?.quantity !== l.quantity);

  // Closing with unsaved edits asks first; closing a pristine editor doesn't.
  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }
  const keepEditing = useCallback(() => setConfirmDiscard(false), []);

  function setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.product_id !== productId));
      return;
    }
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, quantity: Math.min(quantity, MAX_LINE_QUANTITY) } : l)));
  }

  async function handleSave() {
    if (lines.length === 0) {
      setError('الطلب لازم يحتوي على منتج واحد على الأقل — لو عايزة تلغي الطلب كامل استخدمي زرار الإلغاء');
      return;
    }
    if (address.trim().length < 5) {
      setError('اكتبي عنوان التوصيل بالتفصيل');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await orderApi.edit(
        order.id,
        {
          items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
          city: city || undefined,
          shipping_address: address.trim(),
        },
        token
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التعديل');
    } finally {
      setSaving(false);
    }
  }

  // The order's current city stays selectable even if staff later paused
  // delivery there (saving then explains why it can't be kept).
  const cityOptions: { city: string; fee: number | null }[] =
    !order.city || rates.some((r) => r.city === order.city) ? rates : [{ city: order.city, fee: null }, ...rates];

  return (
    <div className="rounded border p-4 mt-2" style={{ background: 'var(--color-surface-tint)', borderColor: 'var(--color-line)' }}>
      {error && (
        <div role="alert" className="notice notice-error mb-3">
          {error}
        </div>
      )}

      <ul className="flex flex-col gap-2 mb-4">
        {lines.map((l) => (
          <li key={l.product_id} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex-1 min-w-0">{l.name}</span>
            <div className="flex items-center border rounded bg-white" style={{ borderColor: 'var(--color-line)' }}>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
                aria-label={`زيادة كمية ${l.name}`}
                disabled={l.quantity >= MAX_LINE_QUANTITY}
                onClick={() => setQuantity(l.product_id, l.quantity + 1)}
              >
                <Icon name="plus" size={14} />
              </button>
              <span className="w-7 text-center font-bold">{l.quantity.toLocaleString('ar-EG')}</span>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center disabled:opacity-40"
                aria-label={`تقليل كمية ${l.name}`}
                disabled={l.quantity <= 1}
                onClick={() => setQuantity(l.product_id, l.quantity - 1)}
              >
                <Icon name="minus" size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setQuantity(l.product_id, 0)}
              className="flex-none p-1 transition-colors text-[var(--color-ink-muted)] hover:text-[var(--color-error)]"
              aria-label={`حذف ${l.name} من الطلب`}
            >
              <Icon name="trash" size={17} />
            </button>
          </li>
        ))}
      </ul>
      {lines.length === 0 && (
        <p role="status" className="notice notice-info mb-4">
          شلتي كل المنتجات من الطلب. أضيفي منتج واحد على الأقل، أو استخدمي زرار «إلغاء الطلب» لو عايزة تلغيه كامل.
        </p>
      )}

      <ProductSearch
        exclude={lines.map((l) => l.product_id)}
        onPick={(p) => setLines((prev) => [...prev, { product_id: p.id, name: p.name, quantity: 1 }])}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_1fr] gap-3 mb-4">
        <div className="field">
          <label htmlFor={`${uid}-city`}>المحافظة</label>
          <select id={`${uid}-city`} value={city} onChange={(e) => setCity(e.target.value)}>
            {cityOptions.map((r) => (
              <option key={r.city} value={r.city}>{r.fee === null ? r.city : `${r.city} — شحن ${egp(r.fee)}`}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-address`}>عنوان التوصيل</label>
          <textarea id={`${uid}-address`} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </div>
      </div>
      <p className="text-[12px] mb-4 text-ink-muted">
        الأسعار ومصاريف الشحن والخصم بتتحسب من جديد عند الحفظ بأسعار النهارده.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !dirty || lines.length === 0}>
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={requestClose} disabled={saving}>
          إلغاء التعديل
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        tone="warning"
        title="تجاهل التعديلات؟"
        message="التعديلات اللي عملتيها على الطلب مش هتتحفظ، والطلب هيفضل زي ما هو."
        confirmLabel="تجاهل التعديلات"
        cancelLabel="كمّلي التعديل"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={keepEditing}
      />
    </div>
  );
}
