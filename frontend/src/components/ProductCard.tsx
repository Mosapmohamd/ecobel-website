'use client';

import Link from 'next/link';
import type { Product } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useToast } from '@/lib/toast';
import { egp } from '@/lib/constants';
import ProductImage from './ProductImage';
import Icon from './Icon';

/** The one product tile — catalog, offers, featured, related and wishlist.
 * Price and offer come from the server (`product.price` / `product.offer`). */
export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const toast = useToast();
  const wished = has(product.id);
  const outOfStock = product.max_quantity === 0;
  const onOffer = product.price < product.sale_price;
  const percentOff = onOffer && product.sale_price > 0 ? Math.round((1 - product.price / product.sale_price) * 100) : 0;

  return (
    <article className="card card-hover group overflow-hidden flex flex-col">
      <div className="relative">
        <Link href={`/products/${product.id}`} className="block" tabIndex={-1} aria-hidden="true">
          <div className="relative aspect-square overflow-hidden bg-surface-tint">
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
              <ProductImage src={product.image_url} alt="" sizes="(max-width: 359px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 290px" />
            </div>
          </div>
        </Link>
        {percentOff > 0 ? (
          <span className="absolute top-3 right-3 badge bg-sale text-surface">خصم {percentOff.toLocaleString('ar-EG')}%</span>
        ) : product.stock_status === 'low' ? (
          <span className="absolute top-3 right-3 badge bg-surface-muted text-primary">كمية محدودة</span>
        ) : null}
        <button
          type="button"
          aria-label={wished ? `إزالة ${product.name} من المفضلة` : `إضافة ${product.name} للمفضلة`}
          aria-pressed={wished}
          onClick={() => {
            toggle(product.id);
            // Removal is the one that can surprise (e.g. the card vanishes
            // from the wishlist page) — offer an undo.
            if (wished) {
              toast.show('اتشال المنتج من المفضلة', { tone: 'info', action: { label: 'تراجع', onClick: () => toggle(product.id) } });
            }
          }}
          className={`absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center bg-surface/90 backdrop-blur shadow-soft transition-colors ${
            wished ? 'text-sale' : 'text-ink-secondary hover:text-sale'
          }`}
        >
          <Icon name="heart" size={17} style={{ fill: wished ? 'currentColor' : 'none' }} />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="text-label-sm font-bold text-ink-muted">{product.category_name}</div>
        <h3 className="mt-1 font-display text-title font-bold leading-snug line-clamp-2">
          <Link href={`/products/${product.id}`} className="transition-colors hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto pt-3 flex flex-wrap items-baseline gap-x-2">
          <span className={`text-headline-sm font-bold ${onOffer ? 'text-sale' : 'text-ink'}`}>{egp(product.price)}</span>
          {onOffer && <span className="text-body-sm line-through text-ink-muted">{egp(product.sale_price)}</span>}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm mt-3 w-full"
          disabled={outOfStock}
          onClick={() => {
            add(product.id, 1);
            toast.show(`تمت إضافة ${product.name} للسلة`, { action: { label: 'عرض السلة', href: '/cart' } });
          }}
        >
          {outOfStock ? 'نفد من المخزون' : (
            <>
              <Icon name="bag" size={17} />
              أضيفي للسلة
            </>
          )}
        </button>
      </div>
    </article>
  );
}

/** Placeholder with the card's exact shape while products load. */
export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden flex flex-col animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="aspect-square bg-surface-tint" />
      <div className="p-4 flex flex-col gap-2.5">
        <div className="h-3 w-1/3 rounded bg-surface-muted" />
        <div className="h-4 w-4/5 rounded bg-surface-muted" />
        <div className="h-5 w-2/5 rounded bg-surface-muted mt-2" />
        <div className="h-11 w-full rounded bg-surface-muted mt-1" />
      </div>
    </div>
  );
}
