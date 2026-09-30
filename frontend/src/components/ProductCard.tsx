'use client';

import Link from 'next/link';
import type { Product, Offer } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';

export default function ProductCard({ product, offer }: { product: Product; offer?: Offer }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const wished = has(product.id);
  const percentOff = offer ? Math.round((1 - offer.offer_price / product.sale_price) * 100) : 0;

  return (
    <div className="rounded overflow-hidden border flex flex-col" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
      <Link href={`/products/${product.id}`} className="relative block">
        <div
          className="aspect-square flex items-center justify-center"
          style={{ background: 'var(--parchment-2)' }}
        >
          <ProductGlyph name={product.name} />
        </div>
        {offer && (
          <span className="absolute top-2 right-2 badge" style={{ background: 'var(--rose)', color: '#fff' }}>
            خصم {percentOff}%
          </span>
        )}
        <button
          aria-label="أضيفي للمفضلة"
          onClick={(e) => {
            e.preventDefault();
            toggle(product);
          }}
          className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.9)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={wished ? 'var(--rose)' : 'none'} stroke={wished ? 'var(--rose)' : 'var(--forest)'} strokeWidth="2">
            <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
          </svg>
        </button>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11.5px] font-bold" style={{ color: 'var(--sage)' }}>{product.category_name}</div>
        <Link href={`/products/${product.id}`} className="text-[15px] font-bold mt-1 leading-snug">
          {product.name}
        </Link>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="flex items-baseline gap-2">
            <span className="font-extrabold" style={{ color: 'var(--forest)' }}>
              {(offer?.offer_price ?? product.sale_price).toLocaleString('ar-EG')} ج.م
            </span>
            {offer && (
              <span className="text-[13px] line-through" style={{ color: '#8a8074' }}>
                {product.sale_price.toLocaleString('ar-EG')} ج.م
              </span>
            )}
          </span>
          {product.stock_status === 'low' && <span className="badge" style={{ background: 'rgba(201,134,42,0.15)', color: '#c9862a' }}>كمية محدودة</span>}
        </div>
        <button
          className="btn btn-primary mt-3 w-full"
          onClick={() => add(offer ? { ...product, sale_price: offer.offer_price } : product, 1)}
        >
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
