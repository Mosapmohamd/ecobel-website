'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { catalogApi, type Category, type ProductPage, type ProductSort, type Routine } from '@/lib/api';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import RoutineCard from '@/components/RoutineCard';
import Icon from '@/components/Icon';
import { errorProps } from '@/components/FieldError';
import { ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';
import { CATALOG_PAGE_SIZE, parseCatalogQuery, routineQueryOf, toProductQuery, toSearch, type CatalogQuery } from '@/lib/catalogQuery';

const PAGE_SIZE = CATALOG_PAGE_SIZE;
const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'الأحدث',
  price_asc: 'السعر: من الأقل للأعلى',
  price_desc: 'السعر: من الأعلى للأقل',
  name: 'الاسم (أ - ي)',
};
const grid = 'grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6';

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);

/** Everything about the listing lives in the URL, so results are linkable
 * and survive refresh/back (parsed the same way on the server). */
function useCatalogQuery() {
  const sp = useSearchParams();
  return parseCatalogQuery((k) => sp.get(k));
}

type Query = CatalogQuery;

/** What the server already fetched for the first render. */
export interface CatalogInitial {
  key: string;
  page: ProductPage | null;
  categories: Category[] | null;
  routineCount: number | null;
  routineMatch: { q: string; routines: Routine[] } | null;
}

function chipClass(active: boolean) {
  return `inline-flex items-center gap-1.5 h-10 px-4 rounded border text-label-lg font-bold whitespace-nowrap transition-colors ${
    active
      ? 'bg-primary border-primary text-surface'
      : 'bg-surface border-line text-ink-secondary hover:border-primary hover:text-primary'
  }`;
}

function ProductsContent({ initial }: { initial: CatalogInitial | null }) {
  const query = useCatalogQuery();
  const router = useRouter();
  const pathname = usePathname();
  const [categories, setCategories] = useState<Category[]>(initial?.categories ?? []);
  const [routineCount, setRoutineCount] = useState(initial?.routineCount ?? 0);
  const [attempt, setAttempt] = useState(0);
  const key = toSearch(query);
  const [result, setResult] = useState<{ key: string; page: ProductPage | null; error: string | null } | null>(
    initial?.page ? { key: initial.key, page: initial.page, error: null } : null,
  );

  // Whatever the server already rendered isn't fetched again.
  useEffect(() => {
    if (!initial?.categories) catalogApi.categories().then(setCategories).catch(() => {});
    if (initial?.routineCount == null) catalogApi.routines().then((r) => setRoutineCount(r.length)).catch(() => {});
  }, [initial]);

  useEffect(() => {
    if (attempt === 0 && result?.key === key && result.page) return; // already have this page
    let cancelled = false;
    catalogApi
      .products(toProductQuery(query))
      .then((page) => !cancelled && setResult({ key, page, error: null }))
      .catch((err) => !cancelled && setResult({ key, page: null, error: err instanceof Error ? err.message : 'تعذر تحميل المنتجات' }));
    return () => {
      cancelled = true;
    };
    // `key` encodes every query field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const productsLoading = result?.key !== key;

  // A search also finds routines — unless a product-only filter (category,
  // price, offers) narrows it, since routines have none of those.
  const routineQuery = routineQueryOf(query);
  const [routineResult, setRoutineResult] = useState<{ q: string; routines: Routine[] } | null>(initial?.routineMatch ?? null);
  useEffect(() => {
    if (!routineQuery) return;
    if (attempt === 0 && routineResult?.q === routineQuery) return; // already have these matches
    let cancelled = false;
    catalogApi
      .routines(routineQuery)
      .then((routines) => !cancelled && setRoutineResult({ q: routineQuery, routines }))
      // Routine matches are a bonus to the product results — if they can't
      // load, the products still show (and carry their own error state).
      .catch(() => !cancelled && setRoutineResult({ q: routineQuery, routines: [] }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routineResult is only the "already fetched" check
  }, [routineQuery, attempt]);
  const routinesLoading = !!routineQuery && routineResult?.q !== routineQuery;
  const matchedRoutines = routineQuery && !routinesLoading ? routineResult?.routines ?? [] : [];
  // Show results only once both have arrived, so nothing jumps around.
  const loading = productsLoading || routinesLoading;
  const page = loading ? null : result?.page ?? null;
  const error = productsLoading ? null : result?.error ?? null;

  function update(changes: Partial<Query>) {
    // Any filter change starts again from page 1.
    router.push(`${pathname}${toSearch({ ...query, page: 1, ...changes })}`, { scroll: changes.page !== undefined });
  }

  const activeCategory = categories.find((c) => c.id === query.categoryId);
  const totalAll = useMemo(() => categories.reduce((sum, c) => sum + c.product_count, 0), [categories]);
  const title = query.q ? `نتائج البحث عن "${query.q}"` : activeCategory ? activeCategory.name : query.onOffer ? 'العروض والتخفيضات' : 'كل المنتجات';
  const hasFilters = query.minPrice !== undefined || query.maxPrice !== undefined || query.onOffer || query.sort !== 'newest';
  const pages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <section className="border-b border-line bg-surface-tint">
        <div className="page-container py-8">
          <nav aria-label="مسار التصفح" className="flex flex-wrap items-center gap-1.5 text-body-sm text-ink-muted mb-3">
            <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
            <Icon name="chevronLeft" size={14} />
            {activeCategory || query.q || query.onOffer ? (
              <>
                <Link href="/products" className="hover:text-primary transition-colors">كل المنتجات</Link>
                <Icon name="chevronLeft" size={14} />
                <span className="text-ink" aria-current="page">{query.q ? 'البحث' : title}</span>
              </>
            ) : (
              <span className="text-ink" aria-current="page">كل المنتجات</span>
            )}
          </nav>
          <h1 className="text-headline-md lg:text-headline-lg">{title}</h1>
          {page && (
            <p className="mt-1 text-body-sm text-ink-muted" role="status">
              {page.total.toLocaleString('ar-EG')} منتج
              {matchedRoutines.length > 0 && ` و${matchedRoutines.length.toLocaleString('ar-EG')} روتين`}
            </p>
          )}
        </div>
      </section>

      <div className="page-container py-8">
        <nav aria-label="الفئات" className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 lg:flex-wrap mb-6">
          <Link href={`/products${toSearch({ q: query.q })}`} className={chipClass(!query.categoryId)} aria-current={!query.categoryId ? 'page' : undefined}>
            الكل
            {totalAll > 0 && <span className="text-label font-medium">({totalAll.toLocaleString('ar-EG')})</span>}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products${toSearch({ categoryId: c.id, q: query.q })}`}
              className={chipClass(query.categoryId === c.id)}
              aria-current={query.categoryId === c.id ? 'page' : undefined}
            >
              {c.name}
              <span className="text-label font-medium">({c.product_count.toLocaleString('ar-EG')})</span>
            </Link>
          ))}
          {routineCount > 0 && (
            <Link href={ROUTINES_PATH} className={chipClass(false)}>
              {ROUTINES_LABEL}
              <span className="text-label font-medium">({routineCount.toLocaleString('ar-EG')})</span>
            </Link>
          )}
        </nav>

        <Filters query={query} onApply={update} hasFilters={hasFilters} />

        {loading ? (
          <div className={grid} aria-busy="true">
            <span className="sr-only" role="status">جاري تحميل المنتجات...</span>
            {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div role="alert" className="notice notice-error flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>حاولي تاني</button>
          </div>
        ) : (!page || page.items.length === 0) && matchedRoutines.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-body text-ink-muted mb-5">
              {query.q ? `مفيش منتجات مطابقة لـ "${query.q}".` : 'مفيش منتجات مطابقة للاختيارات دي.'}
            </p>
            <Link href="/products" className="btn btn-secondary">عرض كل المنتجات</Link>
          </div>
        ) : (
          <>
            {matchedRoutines.length > 0 && (
              <section aria-labelledby="search-routines" className="mb-10">
                <h2 id="search-routines" className="text-headline-sm mb-4">
                  روتينات مطابقة <span className="text-body-sm text-ink-muted">({matchedRoutines.length.toLocaleString('ar-EG')})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {matchedRoutines.map((r) => <RoutineCard key={r.id} routine={r} />)}
                </div>
              </section>
            )}
            {/* Product cards use <h3>: keep an <h2> above them (visible when
                routine matches are shown too, otherwise for screen readers). */}
            {matchedRoutines.length === 0 && <h2 className="sr-only">قائمة المنتجات</h2>}
            {matchedRoutines.length > 0 && (
              <h2 className="text-headline-sm mb-4">
                منتجات مطابقة <span className="text-body-sm text-ink-muted">({(page?.total ?? 0).toLocaleString('ar-EG')})</span>
              </h2>
            )}
            {page && page.items.length > 0 ? (
              <div className={grid}>
                {page.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <p className="text-body text-ink-muted">مفيش منتجات مطابقة لـ &quot;{query.q}&quot;.</p>
            )}
            {page && pages > 1 && <Pagination current={query.page} pages={pages} total={page.total} onPage={(n) => update({ page: n })} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Sort, price range and "offers only" — the same controls on every
 * screen size; price applies on submit, the rest immediately. */
function Filters({ query, onApply, hasFilters }: { query: Query; onApply: (c: Partial<Query>) => void; hasFilters: boolean }) {
  const [min, setMin] = useState(query.minPrice?.toString() ?? '');
  const [max, setMax] = useState(query.maxPrice?.toString() ?? '');
  // Keep the inputs in step with the URL (back/forward, reset).
  const [synced, setSynced] = useState(`${query.minPrice}|${query.maxPrice}`);
  const urlPrice = `${query.minPrice}|${query.maxPrice}`;
  if (urlPrice !== synced) {
    setSynced(urlPrice);
    setMin(query.minPrice?.toString() ?? '');
    setMax(query.maxPrice?.toString() ?? '');
  }

  const [priceError, setPriceError] = useState<string | null>(null);

  function applyPrice(e: FormEvent) {
    e.preventDefault();
    const lo = num(min.trim() || null);
    const hi = num(max.trim() || null);
    if ((min.trim() && lo === undefined) || (max.trim() && hi === undefined)) {
      setPriceError('اكتبي السعر بالأرقام (صفر أو أكتر)');
      return;
    }
    setPriceError(null);
    onApply(lo !== undefined && hi !== undefined && lo > hi ? { minPrice: hi, maxPrice: lo } : { minPrice: lo, maxPrice: hi });
  }

  return (
    <div className="mb-6 rounded bg-surface-tint p-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
      <label className="flex items-center gap-2 text-body-sm">
        <span className="flex-none font-bold text-ink-secondary">ترتيب حسب</span>
        <select
          value={query.sort}
          onChange={(e) => onApply({ sort: e.target.value as ProductSort })}
          className="input !w-auto !py-2 !text-body-sm flex-1 lg:flex-none"
        >
          {(Object.keys(SORT_LABELS) as ProductSort[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </label>

      <form onSubmit={applyPrice} noValidate className="flex flex-wrap items-center gap-2 text-body-sm">
        <span className="font-bold text-ink-secondary">السعر</span>
        <input type="number" inputMode="numeric" min={0} placeholder="من" value={min} onChange={(e) => setMin(e.target.value)} aria-label="أقل سعر بالجنيه" {...errorProps('price-err', priceError)} className="input !w-24 !py-2 !text-body-sm text-center" />
        <span className="text-ink-muted">—</span>
        <input type="number" inputMode="numeric" min={0} placeholder="إلى" value={max} onChange={(e) => setMax(e.target.value)} aria-label="أعلى سعر بالجنيه" {...errorProps('price-err', priceError)} className="input !w-24 !py-2 !text-body-sm text-center" />
        <span className="text-ink-muted">ج.م</span>
        <button type="submit" className="btn btn-primary btn-sm !min-h-10">تطبيق</button>
        {priceError && <p id="price-err" role="alert" className="basis-full text-[12px] text-error">{priceError}</p>}
      </form>

      <label className="flex items-center gap-2 text-body-sm font-bold text-ink-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={query.onOffer}
          onChange={(e) => onApply({ onOffer: e.target.checked })}
          className="w-4 h-4 accent-[var(--color-primary)]"
        />
        العروض فقط
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onApply({ minPrice: undefined, maxPrice: undefined, onOffer: false, sort: 'newest' })}
          className="lg:mr-auto self-start text-body-sm underline text-ink-muted hover:text-primary transition-colors"
        >
          إعادة تعيين الفلاتر
        </button>
      )}
    </div>
  );
}

function Pagination({ current, pages, total, onPage }: { current: number; pages: number; total: number; onPage: (n: number) => void }) {
  const from = (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);
  const btn = 'min-w-10 h-10 px-3 rounded border text-label-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <nav aria-label="صفحات النتائج" className="mt-10 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-body-sm text-ink-muted">
        عرض {from.toLocaleString('ar-EG')}–{to.toLocaleString('ar-EG')} من {total.toLocaleString('ar-EG')} منتج
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} border-line bg-surface`} disabled={current <= 1} onClick={() => onPage(current - 1)}>
          السابق
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-current={n === current ? 'page' : undefined}
            className={`${btn} ${n === current ? 'bg-primary border-primary text-surface' : 'border-line bg-surface hover:border-primary'}`}
            onClick={() => onPage(n)}
          >
            {n.toLocaleString('ar-EG')}
          </button>
        ))}
        <button type="button" className={`${btn} border-line bg-surface`} disabled={current >= pages} onClick={() => onPage(current + 1)}>
          التالي
        </button>
      </div>
    </nav>
  );
}

export default function CatalogClient({ initial }: { initial: CatalogInitial | null }) {
  return (
    <Suspense fallback={<div className="page-container py-12 text-body text-ink-muted">جاري التحميل...</div>}>
      <ProductsContent initial={initial} />
    </Suspense>
  );
}
