'use client';

import Link from 'next/link';
import type { CartBundle } from '@/lib/api';
import type { CartBundleLine } from '@/lib/cart';
import { egp } from '@/lib/constants';
import ProductImage from './ProductImage';
import Icon from './Icon';

/** One bundle offer in the cart — a single item with its contents listed
 * beneath it. Quantity changes the number of whole bundles; removing it
 * removes everything in it. Prices are the server quote's (`view`). */
export default function CartBundleItem({
  bundle,
  view,
  onQuantity,
  onRemove,
}: {
  bundle: CartBundleLine;
  view: CartBundle | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const name = view?.name || 'باقة';
  const firstImage = view?.items.find((i) => i.product?.image_url)?.product?.image_url ?? null;
  const productName = (id: string) => view?.items.find((i) => i.product_id === id)?.product?.name ?? 'منتج';

  if (!view) {
    return (
      <li className="flex gap-3 py-4 border-b border-line last:border-b-0 animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <span className="w-20 h-20 rounded bg-surface-tint flex-none" />
        <span className="flex-1 flex flex-col gap-2 pt-1">
          <span className="h-4 w-3/4 rounded bg-surface-muted" />
          <span className="h-4 w-1/2 rounded bg-surface-muted" />
        </span>
      </li>
    );
  }

  return (
    <li className="flex gap-3 py-4 border-b border-line last:border-b-0" data-testid="cart-bundle">
      <Link href={`/products?promotion=${encodeURIComponent(bundle.promotionId)}`} tabIndex={-1} aria-hidden="true"
        className="relative w-20 h-20 rounded overflow-hidden flex-none border border-line bg-surface-tint">
        <ProductImage src={firstImage} alt="" sizes="80px" />
        <span className="absolute bottom-1 right-1 badge bg-brand-deep text-surface !text-[11px] !px-1.5 !py-0.5">باقة</span>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-body leading-snug line-clamp-2">{name}</p>
            {view.summary && <p className="text-body-sm text-ink-muted">{view.summary}</p>}
          </div>
          <button type="button" onClick={onRemove} aria-label={`حذف ${name} بكل منتجاتها`}
            className="flex-none p-1 transition-colors text-ink-muted hover:text-error">
            <Icon name="trash" size={17} />
          </button>
        </div>
        <ul className="mt-1.5 text-body-sm text-ink-secondary flex flex-col gap-0.5" aria-label={`محتوى ${name}`}>
          {bundle.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-1.5 min-w-0">
              <Icon name="check" size={13} className="flex-none text-ink-muted" />
              <span className="truncate">{productName(i.productId)}</span>
              <span className="flex-none text-ink-muted">× {(i.quantity * bundle.quantity).toLocaleString('ar-EG')}</span>
            </li>
          ))}
        </ul>
        {view.issue && (
          <p role="alert" className="mt-1 text-body-sm text-error">
            {view.issue}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <div className="flex items-center border border-line rounded" role="group" aria-label={`عدد الباقات من ${name}`}>
            <button type="button" className="w-9 h-9 flex items-center justify-center disabled:opacity-40"
              aria-label={`باقة كمان من ${name}`} disabled={bundle.quantity >= 20} onClick={() => onQuantity(bundle.quantity + 1)}>
              <Icon name="plus" size={14} />
            </button>
            <span className="w-8 text-center text-body font-bold">{bundle.quantity.toLocaleString('ar-EG')}</span>
            <button type="button" className="w-9 h-9 flex items-center justify-center"
              aria-label={bundle.quantity === 1 ? `حذف ${name} بكل منتجاتها` : `باقة أقل من ${name}`}
              onClick={() => (bundle.quantity === 1 ? onRemove() : onQuantity(bundle.quantity - 1))}>
              <Icon name="minus" size={14} />
            </button>
          </div>
          {!view.issue && (
            <span className="text-left">
              <span className="block font-bold text-body text-brand-deep">{egp(view.total)}</span>
              {view.discount > 0 && (
                <>
                  <span className="block text-body-sm line-through text-ink-muted">{egp(view.regular_total)}</span>
                  <span className="block text-body-sm font-bold text-success-strong">وفّرتي {egp(view.discount)}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
