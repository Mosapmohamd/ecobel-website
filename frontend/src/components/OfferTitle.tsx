import Icon from './Icon';
import { offerTitle } from '@/lib/offers';

/** The live offer's own title, wherever its price is shown (card, product
 * page, routine item, cart line). Renders nothing without an offer; the
 * API only sends offers that are running right now. `dir="auto"` keeps an
 * English title readable inside the Arabic page. */
export default function OfferTitle({
  offer,
  className = '',
}: {
  offer: { title?: string | null } | null | undefined;
  className?: string;
}) {
  if (!offer) return null;
  const title = offerTitle(offer);
  return (
    <span className={`offer-title flex items-center gap-1 min-w-0 text-label font-bold text-ink-secondary ${className}`}>
      <Icon name="tag" size={14} className="flex-none" />
      <span dir="auto" className="min-w-0 truncate" title={title}>{title}</span>
    </span>
  );
}
