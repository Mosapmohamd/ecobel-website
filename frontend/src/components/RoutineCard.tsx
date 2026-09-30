'use client';

import { useCart } from '@/lib/cart';
import { ProductGlyph } from './ProductCard';
import type { Routine } from '@/lib/api';

export default function RoutineCard({ routine }: { routine: Routine }) {
  const { add } = useCart();
  const total = routine.items.reduce((sum, it) => sum + it.sale_price, 0);

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
    <div className="rounded border p-5" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
      <div className="text-[15px] font-bold mb-1">{routine.name}</div>
      {routine.description && (
        <p className="text-[13px] mb-4" style={{ color: '#8a8074' }}>{routine.description}</p>
      )}

      <div className="flex items-center gap-3 mb-4">
        {routine.items.map((it, i) => (
          <div key={it.product_id} className="flex items-center gap-2">
            <div
              className="w-14 h-14 rounded flex items-center justify-center flex-none"
              style={{ background: 'var(--parchment-2)' }}
              title={it.product_name}
            >
              <ProductGlyph name={it.product_name} />
            </div>
            {i < routine.items.length - 1 && <span style={{ color: 'var(--gold)' }}>+</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 mb-4 text-[13px]" style={{ color: '#8a8074' }}>
        {routine.items.map((it) => (
          <div key={it.product_id} className="flex justify-between">
            <span>{it.product_name}</span>
            <span>{it.sale_price.toLocaleString('ar-EG')} ج.م</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        <span className="font-extrabold" style={{ color: 'var(--forest)' }}>
          الإجمالي: {total.toLocaleString('ar-EG')} ج.م
        </span>
        <button className="btn btn-primary" onClick={addRoutineToCart}>
          أضيفي الروتين كامل
        </button>
      </div>
    </div>
  );
}
