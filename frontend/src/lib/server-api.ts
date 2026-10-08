import { cache } from 'react';
import type { Category, Product, ProductPage, ReviewSummary, Routine } from './api';

/** Server components only. Data for server-rendered pages (HTML that search engines and first
 * paint see). Same API, same authoritative prices/stock as the browser.
 *
 * API_INTERNAL_BASE: optional server-only URL of the storefront API when the
 * server reaches it differently from browsers (e.g. a private network).
 *
 * Every fetch is uncached (`no-store`) unless it carries no price/stock data
 * — prices must always match what checkout charges. A failed fetch returns
 * null: the page still renders and its client component loads the data
 * itself (and shows its own error state), exactly as before. */
const BASE = process.env.API_INTERNAL_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8002';

export const NOT_FOUND = Symbol('not-found');

async function get<T>(path: string, revalidate?: number): Promise<T | null | typeof NOT_FOUND> {
  try {
    const res = await fetch(`${BASE}${path}`, revalidate ? { next: { revalidate } } : { cache: 'no-store' });
    if (res.status === 404) return NOT_FOUND;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const orNull = <T,>(v: T | null | typeof NOT_FOUND): T | null => (v === NOT_FOUND ? null : v);

// `cache` dedupes calls made by both generateMetadata and the page itself.
export const getCategories = cache(async () => orNull(await get<Category[]>('/catalog/categories', 300)));
export const getProduct = cache((id: string) => get<Product>(`/catalog/products/${encodeURIComponent(id)}`));
export const getRelated = cache(async (id: string) => orNull(await get<Product[]>(`/catalog/products/${encodeURIComponent(id)}/related`)));
export const getReviews = cache(async (id: string) => orNull(await get<ReviewSummary>(`/products/${encodeURIComponent(id)}/reviews/`)));
export const getRoutine = cache((id: string) => get<Routine>(`/catalog/routines/${encodeURIComponent(id)}`));
export const getRoutines = cache(async (q?: string) => orNull(await get<Routine[]>(`/catalog/routines${q ? `?q=${encodeURIComponent(q)}` : ''}`)));
export const getFeaturedProducts = cache(async () => orNull(await get<Product[]>('/catalog/featured-products')));
export const getFeaturedRoutines = cache(async () => orNull(await get<Routine[]>('/catalog/featured-routines')));
export const getProductPage = cache(async (qs: string) => orNull(await get<ProductPage>(`/catalog/products${qs}`)));
