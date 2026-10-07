/** For promotional copy only ("free shipping over …"). The cart and
 * checkout use the server's own figure (the quote's free_shipping_threshold,
 * from backend app/checkout.py) — keep the two in step. */
export const FREE_SHIPPING_THRESHOLD = 1000;

/** Store contact details — the one place they are written. */
export const SITE_CONTACT = {
  phone: '01508582006',
  /** E.164 form for tel: links. */
  phoneHref: 'tel:+201508582006',
  address: 'المعادي، القاهرة',
  social: {
    facebook: 'https://facebook.com/ecobel.eg',
    instagram: 'https://instagram.com/ecobel.eg',
    tiktok: 'https://tiktok.com/@ecobel.eg',
  },
} as const;

/** Formats an EGP amount the same way everywhere ("١٬٢٥٠ ج.م"). */
export const egp = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`;

/** Routines are their own catalog section, with their own pages. */
export const ROUTINES_PATH = '/routines';
export const ROUTINES_LABEL = 'الروتينات';
