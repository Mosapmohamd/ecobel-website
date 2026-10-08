import type { Metadata } from 'next';
import CatalogClient, { type CatalogInitial } from './CatalogClient';
import { getCategories, getProductPage, getRoutines } from '@/lib/server-api';
import { parseCatalogQuery, productQueryString, routineQueryOf, toProductQuery, toSearch } from '@/lib/catalogQuery';
import { NO_INDEX } from '@/lib/seo';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const queryOf = (sp: Record<string, string | string[] | undefined>) =>
  parseCatalogQuery((k) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  });

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = queryOf(await searchParams);
  const categories = await getCategories();
  const category = q.categoryId ? categories?.find((c) => c.id === q.categoryId) : undefined;

  // One canonical URL per real listing: all products, a category, or offers.
  // Sort, price range and page are views of those — they point back to it.
  const canonical = category ? `/products?category=${encodeURIComponent(category.id)}` : q.onOffer ? '/products?offers=1' : '/products';
  const title = q.q
    ? `نتائج البحث عن "${q.q}"`
    : category
      ? category.name
      : q.onOffer
        ? 'العروض والتخفيضات'
        : 'كل المنتجات';
  const description = category
    ? `تسوّقي ${category.name} من Eco Bel — منتجات طبيعية، شحن لكل المحافظات والدفع عند الاستلام.`
    : q.onOffer
      ? 'أسعار مخفضة على مختارات من منتجات Eco Bel لفترة محدودة.'
      : 'كل منتجات Eco Bel للعناية بالبشرة والشعر والجسم — شحن لكل المحافظات والدفع عند الاستلام.';
  // Search results and filtered/sorted variations aren't separate pages to index.
  const isVariation = !!q.q || q.minPrice !== undefined || q.maxPrice !== undefined || q.sort !== 'newest' || (!!q.categoryId && !category);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    ...(isVariation ? { robots: NO_INDEX } : {}),
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const q = queryOf(await searchParams);
  const routineQuery = routineQueryOf(q);
  const [page, categories, routines, routineMatches] = await Promise.all([
    getProductPage(productQueryString(toProductQuery(q))),
    getCategories(),
    getRoutines(),
    routineQuery ? getRoutines(routineQuery) : Promise.resolve(null),
  ]);
  const initial: CatalogInitial = {
    key: toSearch(q),
    page,
    categories,
    routineCount: routines ? routines.length : null,
    routineMatch: routineQuery && routineMatches ? { q: routineQuery, routines: routineMatches } : null,
  };
  return <CatalogClient initial={initial} />;
}
