import Link from 'next/link';
import type { PromotionPublic } from '@/lib/api';
import Icon from './Icon';

const TYPE_LABEL: Record<PromotionPublic['type'], string> = {
  bundle: 'باقة',
  free_shipping: 'شحن مجاني',
  percentage: 'خصم',
  fixed_amount: 'خصم',
  buy_x_get_y: 'هدية',
};

/** Where an offer's card leads: a bundle or an offer on some products → its
 * products (a bundle's page also has the "add the whole bundle" card); an
 * offer on every product → the catalog. */
export function promotionHref(p: PromotionPublic): string {
  const targeted = p.product_ids.length + p.category_ids.length + p.reward_product_ids.length + p.reward_category_ids.length > 0;
  return targeted ? `/products?promotion=${encodeURIComponent(p.id)}` : '/products';
}

/** The last Cairo day of an offer (`ends_at` is the instant it stops). */
function lastDay(endsAt: string): string {
  return new Date(new Date(endsAt).getTime() - 1).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long' });
}

/** A running cart offer as a card: what it gives, until when, and where to
 * shop it. Text comes from the server (`summary` is computed there). */
export default function PromotionOfferCard({ promotion: p }: { promotion: PromotionPublic }) {
  const everything = promotionHref(p) === '/products';
  return (
    <article className="card p-5 flex flex-col h-full" data-testid="promotion-card">
      <div className="flex items-center justify-between gap-2">
        <span className="badge bg-brand-deep text-surface inline-flex items-center gap-1">
          <Icon name="tag" size={12} />
          {TYPE_LABEL[p.type]}
        </span>
        {p.ends_at && <span className="text-body-sm text-ink-muted">حتى {lastDay(p.ends_at)}</span>}
      </div>
      <h3 className="mt-3 font-display text-title font-bold leading-snug">{p.name}</h3>
      <p className="mt-1 text-headline-sm font-bold text-sale leading-snug">{p.badge_text || p.summary}</p>
      {p.badge_text && p.badge_text !== p.summary && <p className="text-body-sm text-ink-secondary">{p.summary}</p>}
      {p.description && <p className="mt-2 text-body-sm text-ink-muted line-clamp-2">{p.description}</p>}
      {everything && <p className="mt-2 text-body-sm text-ink-secondary">على كل المنتجات — بيتحسب في السلة</p>}
      <div className="mt-auto pt-4">
        <Link href={promotionHref(p)} className="btn btn-primary btn-sm w-full" aria-label={`${p.type === 'bundle' ? 'شوفي الباقة' : 'تسوّقي العرض'}: ${p.name}`}>
          {p.type === 'bundle' ? 'شوفي الباقة' : 'تسوّقي العرض'}
          <Icon name="chevronLeft" size={16} />
        </Link>
      </div>
    </article>
  );
}
