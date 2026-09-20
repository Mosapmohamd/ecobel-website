'use client';

import Link from 'next/link';
import type { Product } from '@/lib/api';
import { useCart } from '@/lib/cart';

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <div className="rounded-lg overflow-hidden border flex flex-col" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
      <Link href={`/products/${product.id}`}>
        <div
          className="aspect-square flex items-center justify-center"
          style={{ background: 'var(--parchment-2)' }}
        >
          <ProductGlyph name={product.name} />
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11.5px] font-bold" style={{ color: 'var(--sage)' }}>{product.category_name}</div>
        <Link href={`/products/${product.id}`} className="text-[15px] font-bold mt-1 leading-snug">
          {product.name}
        </Link>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="font-extrabold" style={{ color: 'var(--forest)' }}>
            {product.sale_price.toLocaleString('ar-EG')} ج.م
          </span>
          {product.stock_status === 'low' && <span className="badge" style={{ background: 'rgba(201,134,42,0.15)', color: '#c9862a' }}>كمية محدودة</span>}
        </div>
        <button className="btn btn-primary mt-3 w-full" onClick={() => add(product, 1)}>
          أضيفي للسلة
        </button>
      </div>
    </div>
  );
}

/** Simple generated placeholder glyph until real product photos exist. */
export function ProductGlyph({ name }: { name: string }) {
  const hue = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0) % 3;
  const colors = ['#1F3A2E', '#7A5A22', '#8FA888'];
  return (
    <svg viewBox="0 0 100 120" width="56%" height="56%">
      <rect x="30" y="30" width="40" height="70" rx="8" fill={colors[hue]} opacity="0.85" />
      <rect x="40" y="16" width="20" height="18" rx="4" fill="#C9A227" />
    </svg>
  );
}
