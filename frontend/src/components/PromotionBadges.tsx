import Link from 'next/link';
import type { PromotionBadge } from '@/lib/api';
import Icon from './Icon';
import BundleOfferCard from './BundleOfferCard';

/** A product's offer labels for its tile: in the server's order (priority),
 * one label per distinct text (two offers saying the same thing show once),
 * at most `max`, plus how many more there are. */
export function cardBadges(promotions: PromotionBadge[] | undefined, max = 2): { labels: string[]; more: number } {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of promotions ?? []) {
    const text = p.badge_text || p.summary;
    const label = p.role === 'reward' ? `هدية: ${text}` : text;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return { labels: labels.slice(0, max), more: Math.max(0, labels.length - max) };
}

/** "و…كمان" for the hidden offers, with Arabic number agreement. */
function moreOffersLabel(n: number): string {
  if (n === 1) return 'وعرض كمان';
  if (n === 2) return 'وعرضين كمان';
  return `و${n.toLocaleString('ar-EG')} ${n <= 10 ? 'عروض' : 'عرض'} كمان`;
}

/** Offer badges on a product tile: up to two, then "+N". The cart applies
 * the offers — these only say which ones the product is part of. */
export function PromotionChips({ promotions, className = '' }: { promotions?: PromotionBadge[]; className?: string }) {
  const { labels, more } = cardBadges(promotions);
  if (!labels.length) return null;
  return (
    <ul aria-label="عروض على المنتج" className={`flex flex-wrap items-center gap-1 min-w-0 ${className}`}>
      {labels.map((label) => (
        <li key={label} className="inline-flex items-center gap-1 max-w-full min-w-0 rounded-sm border border-brand-deep bg-surface-tint px-1.5 py-0.5 text-label-sm font-bold text-brand-deep">
          <Icon name="tag" size={12} className="flex-none" />
          <span className="truncate">{label}</span>
        </li>
      ))}
      {more > 0 && (
        <li className="inline-flex items-center rounded-sm bg-brand-deep px-1.5 py-0.5 text-label-sm font-bold text-surface">
          <span aria-hidden="true">+{more.toLocaleString('ar-EG')}</span>
          <span className="sr-only">{moreOffersLabel(more)}</span>
        </li>
      )}
    </ul>
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
