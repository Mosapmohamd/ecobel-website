'use client';

import { useCart } from '@/lib/cart';
import ProductImage from './ProductImage';
import Icon from './Icon';
import type { Routine } from '@/lib/api';

export default function RoutineCard({ routine }: { routine: Routine }) {
  const { add } = useCart();
  const total = routine.items.reduce((sum, it) => sum + it.sale_price, 0);
  // The backend has no bundle-discount concept for routines today (each
  // item is just its normal sale_price) — there is no real "savings"
  // figure to show yet. This stays wired so a real discount field, if one
  // is ever added to the Routine API, renders automatically without a
  // template change; until then it's intentionally never populated rather
  // than showing an invented number.
  let savings: number | undefined;

  function addRoutineToCart() {
    for (const it of routine.items) {
      add({
        id: it.product_id,
        name: it.product_name,
        category_id: '', category_name: '', sku: null,
        sale_price: it.sale_price, quantity: 999, stock_status: 'ok',
        image_url: it.image_url, description: null,
      }, 1);
    }
  }

  return (
    <div className="card card-hover overflow-hidden flex flex-col">
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.min(routine.items.length, 3) || 1}, 1fr)`, background: 'var(--line)' }}>
        {routine.items.slice(0, 3).map((it) => (
          <div key={it.product_id} className="relative aspect-square" style={{ background: 'var(--parchment)' }} title={it.product_name}>
            <ProductImage src={it.image_url} alt={it.product_name} sizes="160px" />
          </div>
        ))}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="badge flex items-center gap-1" style={{ background: 'var(--parchment-2)', color: 'var(--forest)' }}>
            <Icon name="checkCircle" size={13} />
            روتين من {routine.items.length.toLocaleString('ar-EG')} خطوات
          </span>
          {savings !== undefined && savings > 0 && (
            <span className="badge" style={{ background: 'var(--rose)', color: '#fff' }}>
              توفير {savings.toLocaleString('ar-EG')} ج.م
            </span>
          )}
        </div>
        <h3 className="text-[22px] leading-snug">{routine.name}</h3>
        {routine.description && (
          <p className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{routine.description}</p>
        )}

        <ol className="mt-4 flex flex-col gap-2 text-[13.5px]">
          {routine.items.map((it, i) => (
            <li key={it.product_id} className="flex items-baseline gap-2">
              <span className="font-bold flex-none" style={{ color: 'var(--forest)' }}>{(i + 1).toLocaleString('ar-EG')}.</span>
              <span className="flex-1">{it.product_name}</span>
              <span className="flex-none" style={{ color: 'var(--muted)' }}>{it.sale_price.toLocaleString('ar-EG')} ج.م</span>
            </li>
          ))}
        </ol>

        <div className="mt-auto pt-5">
          <div className="flex items-baseline justify-between mb-3 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[13.5px]" style={{ color: 'var(--muted)' }}>سعر الروتين كامل:</span>
            <span className="text-[18px] font-bold">{total.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <button className="btn btn-primary w-full" onClick={addRoutineToCart}>
            <Icon name="bag" size={18} />
            أضيفي الروتين كامل للسلة
          </button>
        </div>
      </div>
    </div>
  );
}
