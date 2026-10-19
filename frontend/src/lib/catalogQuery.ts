import type { ProductQuery, ProductSort } from './api';

/** The catalog's URL state, shared by the server page (first render,
 * metadata) and the browser (navigation) so both read it identically. */
export const CATALOG_PAGE_SIZE = 24;
export const PRODUCT_SORTS: ProductSort[] = ['newest', 'price_asc', 'price_desc', 'name'];

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);

export function parseCatalogQuery(get: (key: string) => string | null) {
  const sort = get('sort') as ProductSort | null;
  return {
    categoryId: get('category') || undefined,
    q: get('q')?.trim() || undefined,
    minPrice: num(get('min')),
    maxPrice: num(get('max')),
    onOffer: get('offers') === '1',
    sort: (sort && PRODUCT_SORTS.includes(sort) ? sort : 'newest') as ProductSort,
    page: Math.max(1, Math.floor(num(get('page')) ?? 1)),
  };
}

export type CatalogQuery = ReturnType<typeof parseCatalogQuery>;

export function toSearch(q: Partial<CatalogQuery>): string {
  const p = new URLSearchParams();
  if (q.categoryId) p.set('category', q.categoryId);
  if (q.q) p.set('q', q.q);
  if (q.minPrice !== undefined) p.set('min', String(q.minPrice));
  if (q.maxPrice !== undefined) p.set('max', String(q.maxPrice));
  if (q.onOffer) p.set('offers', '1');
  if (q.sort && q.sort !== 'newest') p.set('sort', q.sort);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** The products API request for this URL state. */
export function toProductQuery(q: CatalogQuery): ProductQuery {
  return {
    categoryId: q.categoryId,
    q: q.q,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    onOffer: q.onOffer,
    sort: q.sort,
    limit: CATALOG_PAGE_SIZE,
    offset: (q.page - 1) * CATALOG_PAGE_SIZE,
  };
}

/** Same query string catalogApi.products() sends. */
export function productQueryString(o: ProductQuery): string {
  const params = new URLSearchParams();
  if (o.categoryId) params.set('category_id', o.categoryId);
  if (o.q) params.set('q', o.q);
  if (o.minPrice !== undefined) params.set('min_price', String(o.minPrice));
  if (o.maxPrice !== undefined) params.set('max_price', String(o.maxPrice));
  if (o.onOffer) params.set('on_offer', 'true');
  if (o.sort) params.set('sort', o.sort);
  if (o.limit) params.set('limit', String(o.limit));
  if (o.offset) params.set('offset', String(o.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** A search also finds routines — unless a product-only filter (category,
 * price, offers) narrows it, since routines have none of those. */
export function routineQueryOf(q: CatalogQuery): string | null {
  return q.q && !q.categoryId && q.minPrice === undefined && q.maxPrice === undefined && !q.onOffer ? q.q : null;
}
