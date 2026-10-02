'use client';

import Link from 'next/link';
import type { Product, Offer } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { categoryLabel } from '@/lib/categories';
import ProductImage from './ProductImage';
import Icon from './Icon';

export default function ProductCard({ product, offer }: { product: Product; offer?: Offer }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const wished = has(product.id);
  const percentOff = offer ? Math.round((1 - offer.offer_price / product.sale_price) * 100) : 0;
  const outOfStock = product.stock_status === 'out';

  return (
    <div className="card card-hover group overflow-hidden flex flex-col">
      <Link href={`/products/${product.id}`} className="relative block">
        <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--parchment)' }}>
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage src={product.image_url} alt={product.name} />
          </div>
        </div>
        {offer ? (
          <span className="absolute top-2.5 right-2.5 badge" style={{ background: 'var(--rose)', color: '#fff' }}>
            خصم {percentOff.toLocaleString('ar-EG')}%
          </span>
        ) : product.stock_status === 'low' ? (
          <span className="absolute top-2.5 right-2.5 badge" style={{ background: 'var(--parchment-2)', color: 'var(--forest)' }}>
            كمية محدودة
          </span>
        ) : null}
        <button
          aria-label={wished ? 'إزالة من المفضلة' : 'أضيفي للمفضلة'}
          aria-pressed={wished}
          onClick={(e) => {
            e.preventDefault();
            toggle(product);
          }}
          className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur transition-colors"
          style={{ background: 'rgba(255,255,255,0.85)', color: wished ? 'var(--rose)' : 'var(--muted-strong)' }}
        >
          <Icon name="heart" size={16} style={{ fill: wished ? 'currentColor' : 'none' }} />
        </button>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-[11px] font-bold" style={{ color: 'var(--sage)' }}>{categoryLabel(product.category_name)}</div>
        <Link
          href={`/products/${product.id}`}
          className="text-[15px] font-bold mt-1 leading-snug line-clamp-2 transition-colors hover:text-[var(--forest)]"
        >
          {product.name}
        </Link>
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-[16px] font-bold" style={{ color: offer ? 'var(--rose)' : 'var(--ink)' }}>
            {(offer?.offer_price ?? product.sale_price).toLocaleString('ar-EG')} ج.م
          </span>
          {offer && (
            <span className="text-[13px] line-through" style={{ color: 'var(--muted)' }}>
              {product.sale_price.toLocaleString('ar-EG')} ج.م
            </span>
          )}
        </div>
        <button
          className="btn btn-primary btn-sm mt-3 w-full"
          disabled={outOfStock}
          onClick={() => add(offer ? { ...product, sale_price: offer.offer_price } : product, 1)}
        >
          {outOfStock ? 'نفد من المخزون' : (
            <>
              <Icon name="bag" size={17} />
              أضيفي للسلة
            </>
          )}
        </button>
      </div>
    </div>
  );
}
