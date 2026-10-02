import { API_BASE } from './api';

/** Resolves a product image_url from the API into a usable <Image> src.
 * Absolute URLs (any CDN/storage host) pass through untouched; relative
 * paths are assumed to be served by the storefront API itself. */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}
