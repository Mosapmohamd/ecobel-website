import Link from 'next/link';
import type { PromotionBadge } from '@/lib/api';
import Icon from './Icon';
import BundleOfferCard from './BundleOfferCard';

/** One small line on a product tile: the first cart offer it's part of. */
export function PromotionChip({ promotions, className = '' }: { promotions?: PromotionBadge[]; className?: string }) {
  const p = promotions?.[0];
  if (!p) return null;
  return (
    <p className={`flex items-center gap-1 text-label-sm font-bold text-brand-deep ${className}`}>
      <Icon name="tag" size={13} />
      <span className="line-clamp-1">{p.role === 'reward' ? `هدية مع عرض: ${p.badge_text || p.summary}` : p.badge_text || p.summary}</span>
    </p>
  );
}

/** The product page's offers block: what each offer gives and where its
 * other products are. A bundle shows as its own card, added to the cart
 * whole. The cart applies offers — nothing is computed here. */
export function PromotionList({ promotions }: { promotions?: PromotionBadge[] }) {
  if (!promotions?.length) return null;
  return (
    <section aria-label="عروض على المنتج" className="mt-5 flex flex-col gap-2">
      {promotions.map((p) => p.type === 'bundle' ? (
        <BundleOfferCard key={p.id} promotionId={p.id} />
      ) : (
        <div key={p.id} className="rounded border border-line bg-surface-tint p-3">
          <div className="flex items-center gap-2 font-bold text-body text-brand-deep">
            <Icon name="tag" size={16} />
            {p.role === 'reward' ? `المنتج ده هدية في عرض «${p.name}»` : p.name}
          </div>
          <p className="mt-1 text-body-sm text-ink-secondary">{p.summary}</p>
          {p.description && <p className="mt-1 text-body-sm text-ink-muted">{p.description}</p>}
          <Link href={`/products?promotion=${encodeURIComponent(p.id)}`} className="mt-1.5 inline-block text-body-sm font-bold link-underline text-primary">
            منتجات العرض
          </Link>
        </div>
      ))}
    </section>
  );
}
