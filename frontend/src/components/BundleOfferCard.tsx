'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type BundleOffer } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useToast } from '@/lib/toast';
import { egp } from '@/lib/constants';
import ProductImage from './ProductImage';
import Icon from './Icon';

/** A bundle offer as ONE thing to buy. A fixed bundle is added to the cart
 * whole with one button; a choose-your-own bundle lets the customer pick
 * its products here, then adds the complete bundle at once. Prices shown
 * are the server's; the cart and checkout price the bundle again. */
export default function BundleOfferCard({ promotionId, className = '' }: { promotionId: string; className?: string }) {
  const [state, setState] = useState<{ id: string; offer: BundleOffer | null; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .bundle(promotionId)
      .then((offer) => !cancelled && setState({ id: promotionId, offer, error: false }))
      .catch(() => !cancelled && setState({ id: promotionId, offer: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [promotionId, attempt]);

  const current = state?.id === promotionId ? state : null;
  if (!current) {
    return <div className={`rounded border border-line bg-surface-tint p-4 animate-pulse motion-reduce:animate-none h-40 ${className}`} aria-hidden="true" />;
  }
  if (current.error || !current.offer) {
    return (
      <div className={`rounded border border-line p-4 text-body-sm ${className}`} role="status">
        عرض الباقة ده مش متاح دلوقتي.{' '}
        <button type="button" className="font-bold underline" onClick={() => setAttempt((n) => n + 1)}>حاولي تاني</button>
      </div>
    );
  }
  const offer = current.offer;
  return (
    <section aria-label={`عرض ${offer.name}`} className={`rounded border-2 border-brand-deep bg-surface p-4 sm:p-5 ${className}`} data-testid="bundle-offer">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="badge bg-brand-deep text-surface">{offer.badge_text || 'باقة'}</span>
          <h2 className="mt-2 text-title font-bold font-display leading-snug">{offer.name}</h2>
          <p className="text-body-sm text-ink-secondary">{offer.summary}</p>
          {offer.description && <p className="mt-1 text-body-sm text-ink-muted">{offer.description}</p>}
        </div>
        <div className="text-left flex-none">
          <div className="text-headline-sm font-bold text-sale">{egp(offer.bundle_price)}</div>
          {offer.fixed && offer.regular_total !== null && offer.regular_total > offer.bundle_price && (
            <>
              <div className="text-body-sm line-through text-ink-muted">{egp(offer.regular_total)}</div>
              <div className="text-body-sm font-bold text-success-strong">وفّري {egp(offer.savings ?? 0)}</div>
            </>
          )}
        </div>
      </div>
      {offer.fixed ? <FixedBundle offer={offer} /> : <ChooseBundle offer={offer} />}
    </section>
  );
}

function useAddBundle(offer: BundleOffer) {
  const { addBundle } = useCart();
  const toast = useToast();
  return (items: { productId: string; quantity: number }[]) => {
    addBundle(offer.id, items);
    toast.show(`اتضافت «${offer.name}» للسلة`, { action: { label: 'عرض السلة', href: '/cart' } });
  };
}

function FixedBundle({ offer }: { offer: BundleOffer }) {
  const add = useAddBundle(offer);
  const unavailable = offer.products.filter((p) => p.product.max_quantity < p.quantity);
  return (
    <>
      <h3 className="mt-4 text-label font-bold text-ink-muted">الباقة فيها</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {offer.products.map(({ product, quantity }) => (
          <li key={product.id} className="flex items-center gap-3">
            <Link href={`/products/${product.id}`} className="relative w-12 h-12 rounded overflow-hidden flex-none border border-line bg-surface-tint" tabIndex={-1} aria-hidden="true">
              <ProductImage src={product.image_url} alt="" sizes="48px" />
            </Link>
            <Link href={`/products/${product.id}`} className="flex-1 min-w-0 text-body font-bold truncate hover:text-primary">{product.name}</Link>
            <span className="flex-none text-body-sm text-ink-muted">× {quantity.toLocaleString('ar-EG')}</span>
            <span className="flex-none text-body-sm text-ink-muted">{egp(product.price * quantity)}</span>
          </li>
        ))}
      </ul>
      {!offer.available && (
        <p role="status" className="mt-3 text-body-sm text-error">
          {unavailable.length ? `«${unavailable[0].product.name}» مش متاح بالكمية دي دلوقتي، فالباقة مش متاحة.` : 'الباقة مش متاحة دلوقتي.'}
        </p>
      )}
      <button type="button" className="btn btn-primary w-full mt-4" disabled={!offer.available}
        onClick={() => add(offer.products.map((p) => ({ productId: p.product.id, quantity: p.quantity })))}>
        <Icon name="bag" size={17} />
        أضيفي الباقة للسلة — {egp(offer.bundle_price)}
      </button>
    </>
  );
}

function ChooseBundle({ offer }: { offer: BundleOffer }) {
  const add = useAddBundle(offer);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const size = offer.bundle_quantity;
  const total = Object.values(picked).reduce((a, b) => a + b, 0);
  const regular = offer.products.reduce((sum, { product }) => sum + product.price * (picked[product.id] ?? 0), 0);
  const left = size - total;

  function change(id: string, delta: number, max: number) {
    setPicked((prev) => {
      const now = prev[id] ?? 0;
      const next = Math.max(0, Math.min(now + delta, max, now + Math.max(0, size - total)));
      const out = { ...prev, [id]: next };
      if (!next) delete out[id];
      return out;
    });
  }

  return (
    <>
      <p className="mt-4 text-body font-bold" aria-live="polite">
        {left > 0 ? `اختاري ${left.toLocaleString('ar-EG')} ${left === size ? 'منتجات' : 'كمان'} من ${size.toLocaleString('ar-EG')}` : 'اكتملت الباقة'}
        {offer.distinct_products && <span className="text-body-sm text-ink-muted font-normal"> — منتجات مختلفة</span>}
      </p>
      <div className="h-1.5 mt-2 rounded-sm overflow-hidden bg-surface-tint" aria-hidden="true">
        <div className="h-full bg-brand-deep transition-all" style={{ width: `${Math.min(100, (total / size) * 100)}%` }} />
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-line max-h-96 overflow-y-auto">
        {offer.products.map(({ product }) => {
          const n = picked[product.id] ?? 0;
          const cap = Math.min(product.max_quantity, offer.distinct_products ? 1 : size);
          const out = product.max_quantity === 0;
          return (
            <li key={product.id} className="flex items-center gap-3 py-2">
              <span className="relative w-12 h-12 rounded overflow-hidden flex-none border border-line bg-surface-tint" aria-hidden="true">
                <ProductImage src={product.image_url} alt="" sizes="48px" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-body font-bold truncate">{product.name}</span>
                <span className="block text-body-sm text-ink-muted">{out ? 'نفد من المخزون' : egp(product.price)}</span>
              </span>
              <span className="flex items-center border border-line rounded flex-none" role="group" aria-label={`عدد ${product.name} في الباقة`}>
                <button type="button" className="w-9 h-9 flex items-center justify-center disabled:opacity-40"
                  aria-label={`أضيفي ${product.name} للباقة`} disabled={out || n >= cap || left <= 0} onClick={() => change(product.id, 1, cap)}>
                  <Icon name="plus" size={14} />
                </button>
                <span className="w-7 text-center text-body font-bold">{n.toLocaleString('ar-EG')}</span>
                <button type="button" className="w-9 h-9 flex items-center justify-center disabled:opacity-40"
                  aria-label={`شيلي ${product.name} من الباقة`} disabled={n === 0} onClick={() => change(product.id, -1, cap)}>
                  <Icon name="minus" size={14} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {total > 0 && regular > offer.bundle_price && (
        <p className="mt-2 text-body-sm">
          <span className="line-through text-ink-muted">{egp(regular)}</span>{' '}
          <span className="font-bold text-success-strong">وفّري {egp(regular - offer.bundle_price)}</span>
        </p>
      )}
      <button type="button" className="btn btn-primary w-full mt-4" disabled={left !== 0 || !offer.available}
        onClick={() => {
          add(Object.entries(picked).map(([productId, quantity]) => ({ productId, quantity })));
          setPicked({});
        }}>
        <Icon name="bag" size={17} />
        {left === 0 ? `أضيفي الباقة للسلة — ${egp(offer.bundle_price)}` : `اختاري ${left.toLocaleString('ar-EG')} كمان`}
      </button>
    </>
  );
}
