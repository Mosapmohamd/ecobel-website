'use client';

import { useCart } from '@/lib/cart';
import ProductImage from './ProductImage';
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
    <div className="rounded-sm overflow-hidden flex flex-col" style={{ background: 'var(--cream)', boxShadow: '0 1px 2px rgba(36,37,34,0.06)' }}>
      <div className="p-5 pb-0">
        <span className="badge mb-3 inline-block" style={{ background: 'var(--parchment-2)', color: 'var(--forest-deep)' }}>
          روتين كامل
        </span>
        <div className="text-[17px] font-bold mb-1">{routine.name}</div>
        {routine.description && (
          <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--muted)' }}>{routine.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 mb-3">
        {routine.items.map((it) => (
          <div
            key={it.product_id}
            className="relative flex-1 aspect-square rounded-sm overflow-hidden"
            title={it.product_name}
          >
            <ProductImage src={it.image_url} alt={it.product_name} sizes="120px" />
          </div>
        ))}
      </div>

      <div className="px-5 text-[12.5px] font-bold mb-4" style={{ color: 'var(--sage)' }}>
        {routine.items.length.toLocaleString('ar-EG')} منتجات
      </div>

      <div className="mt-auto px-5 py-4 flex items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="font-extrabold text-[16px]" style={{ color: 'var(--forest)' }}>
            الإجمالي: {total.toLocaleString('ar-EG')} ج.م
          </div>
          {savings !== undefined && savings > 0 && (
            <div className="text-[12.5px] font-bold mt-0.5" style={{ color: 'var(--rose)' }}>
              وفّري {savings.toLocaleString('ar-EG')} ج.م
            </div>
          )}
        </div>
        <button className="btn btn-primary flex-none" onClick={addRoutineToCart}>
          أضيفي الروتين كامل
        </button>
      </div>
    </div>
  );
}
