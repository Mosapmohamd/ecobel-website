/** Shown only if an offer somehow has no usable title (legacy data) — so a
 * badge is never empty or "undefined". A real title is always shown as is. */
export const OFFER_TITLE_FALLBACK = 'عرض خاص';

/** The admin's own name for an offer ("عرض الصيف"), as entered in the
 * accounting system — the single source is the API's `offer.title`. */
export function offerTitle(offer: { title?: string | null } | null | undefined): string {
  const title = offer?.title?.trim();
  return title || OFFER_TITLE_FALLBACK;
}
