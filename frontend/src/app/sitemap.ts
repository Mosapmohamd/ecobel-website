import type { MetadataRoute } from 'next';
import type { Product, ProductPage } from '@/lib/api';
import { getCategories, getProductPage, getRoutines } from '@/lib/server-api';
import { ROUTINES_PATH } from '@/lib/constants';
import { absoluteUrl } from '@/lib/seo';

// Always built per request from the live catalog. Without this, a build that
// can't reach the API prerenders a sitemap with no products and serves it
// unchanged until the next deploy.
export const dynamic = 'force-dynamic';

/** Every product the catalog lists (the API caps a page at 100). */
async function allProducts(): Promise<Product[]> {
  const out: Product[] = [];
  for (let offset = 0; ; offset += 100) {
    const page: ProductPage | null = await getProductPage(`?limit=100&offset=${offset}&sort=name`);
    if (!page) break;
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, routines, products] = await Promise.all([getCategories(), getRoutines(), allProducts()]);
  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/products?offers=1'), changeFrequency: 'daily', priority: 0.7 },
    { url: absoluteUrl(ROUTINES_PATH), changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.4 },
    ...(categories ?? []).map((c) => ({
      url: absoluteUrl(`/products?category=${encodeURIComponent(c.id)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...(routines ?? []).map((r) => ({
      url: absoluteUrl(`${ROUTINES_PATH}/${encodeURIComponent(r.id)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${encodeURIComponent(p.id)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      ...(p.image_url ? { images: [p.image_url] } : {}),
    })),
  ];
}
