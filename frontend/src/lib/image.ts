/** The one place a product's `image_url` (from the API) becomes something
 * the browser may load. The backend sends full URLs on the product-image
 * host (NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL); anything else — a missing
 * value, a legacy relative path, another host — resolves to null, and the
 * caller shows the EcoBel fallback instead of a broken image. */
const BASE = (process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL ?? '').replace(/\/$/, '');

export function resolveImageUrl(url?: string | null): string | null {
  if (!url || !BASE) return null;
  return url.startsWith(`${BASE}/`) ? url : null;
}
