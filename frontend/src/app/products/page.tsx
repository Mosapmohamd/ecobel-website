'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { catalogApi, type Category, type Product, type Offer, type Routine } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import RoutineCard from '@/components/RoutineCard';
import Icon from '@/components/Icon';
import { categoryLabel, ROUTINES_CATEGORY_ID, ROUTINES_CATEGORY_LABEL } from '@/lib/categories';

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name';

const SORT_LABELS: Record<SortOption, string> = {
  default: 'الترتيب الافتراضي',
  price_asc: 'السعر: من الأقل للأعلى',
  price_desc: 'السعر: من الأعلى للأقل',
  name: 'الاسم (أ - ي)',
};

function ProductsContent() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get('category') || undefined;
  const q = searchParams.get('q') || undefined;
  const isRoutinesView = categoryId === ROUTINES_CATEGORY_ID;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('default');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
    catalogApi.offers().then(setOffers).catch(() => {});
    catalogApi.routines().then(setRoutines).catch(() => {}).finally(() => setRoutinesLoading(false));
  }, []);

  useEffect(() => {
    if (isRoutinesView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    catalogApi
      .products({ categoryId, q })
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categoryId, q, isRoutinesView]);

  const offerByProductId = useMemo(() => {
    const map = new Map<string, Offer>();
    offers.forEach((o) => map.set(o.product_id, o));
    return map;
  }, [offers]);

  const visibleProducts = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    let list = products.filter((p) => {
      const effectivePrice = offerByProductId.get(p.id)?.offer_price ?? p.sale_price;
      if (min !== null && effectivePrice < min) return false;
      if (max !== null && effectivePrice > max) return false;
      return true;
    });
    const effective = (p: Product) => offerByProductId.get(p.id)?.offer_price ?? p.sale_price;
    switch (sort) {
      case 'price_asc':
        list = [...list].sort((a, b) => effective(a) - effective(b));
        break;
      case 'price_desc':
        list = [...list].sort((a, b) => effective(b) - effective(a));
        break;
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        break;
    }
    return list;
  }, [products, sort, minPrice, maxPrice, offerByProductId]);

  const activeCategory = categories.find((c) => c.id === categoryId);
  const title = q ? `نتائج البحث عن "${q}"` : isRoutinesView ? ROUTINES_CATEGORY_LABEL : activeCategory ? categoryLabel(activeCategory.name) : 'كل المنتجات';
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : '';
  const hasFilters = !!minPrice || !!maxPrice || sort !== 'default';

  function chipClass(active: boolean) {
    return `inline-flex items-center gap-1.5 h-10 px-4 rounded border text-[14px] font-bold transition-colors whitespace-nowrap ${
      active
        ? 'bg-[var(--forest)] border-[var(--forest)] text-white'
        : 'bg-white border-[var(--line)] text-[var(--muted-strong)] hover:border-[var(--forest)] hover:text-[var(--forest)]'
    }`;
  }

  return (
    <div>
      <section className="border-b" style={{ background: 'var(--parchment)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-8">
          <nav aria-label="مسار التصفح" className="flex items-center gap-1.5 text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
            <Link href="/" className="hover:text-[var(--forest)] transition-colors">الرئيسية</Link>
            <Icon name="chevronLeft" size={14} />
            {activeCategory || isRoutinesView || q ? (
              <>
                <Link href="/products" className="hover:text-[var(--forest)] transition-colors">كل المنتجات</Link>
                <Icon name="chevronLeft" size={14} />
                <span style={{ color: 'var(--ink)' }}>{q ? 'البحث' : title}</span>
              </>
            ) : (
              <span style={{ color: 'var(--ink)' }}>كل المنتجات</span>
            )}
          </nav>
          <h1 className="text-[30px] lg:text-[40px] leading-tight">{title}</h1>
          {q && (
            <Link href="/products" className="text-[13.5px] font-bold link-underline mt-2 inline-block" style={{ color: 'var(--forest)' }}>
              عرض كل المنتجات
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap mb-6">
          <Link href={q ? `/products?q=${encodeURIComponent(q)}` : '/products'} className={chipClass(!categoryId)}>
            الكل
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/products?category=${c.id}${qSuffix}`} className={chipClass(categoryId === c.id)}>
              {categoryLabel(c.name)}
              <span className="text-[12px] font-medium opacity-75">({c.product_count.toLocaleString('ar-EG')})</span>
            </Link>
          ))}
          {routines.length > 0 && (
            <Link href={`/products?category=${ROUTINES_CATEGORY_ID}`} className={chipClass(isRoutinesView)}>
              {ROUTINES_CATEGORY_LABEL}
              <span className="text-[12px] font-medium opacity-75">({routines.length.toLocaleString('ar-EG')})</span>
            </Link>
          )}
        </div>

        {isRoutinesView ? (
          <>
            <p className="text-[13.5px] mb-6" style={{ color: 'var(--muted)' }}>
              {routinesLoading ? '' : `${routines.length.toLocaleString('ar-EG')} روتين`}
            </p>
            {routinesLoading ? (
              <p style={{ color: 'var(--muted)' }}>جاري التحميل...</p>
            ) : routines.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>لا توجد روتينات متاحة حاليًا.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {routines.map((r) => (
                  <RoutineCard key={r.id} routine={r} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded border"
              style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}
            >
              <p className="text-[13.5px] px-1" style={{ color: 'var(--muted)' }}>
                {loading ? '' : `عرض ${visibleProducts.length.toLocaleString('ar-EG')} منتج`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-[13px]">
                  <span style={{ color: 'var(--muted-strong)' }}>السعر:</span>
                  <input
                    type="number" min={0} placeholder="من" value={minPrice} aria-label="أقل سعر"
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="input !w-20 !py-2 !text-[13px] text-center"
                  />
                  <span style={{ color: 'var(--muted)' }}>—</span>
                  <input
                    type="number" min={0} placeholder="إلى" value={maxPrice} aria-label="أعلى سعر"
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="input !w-20 !py-2 !text-[13px] text-center"
                  />
                  <span style={{ color: 'var(--muted)' }}>ج.م</span>
                </div>
                <label className="flex items-center gap-1.5 text-[13px]">
                  <span style={{ color: 'var(--muted-strong)' }}>ترتيب:</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="input !w-auto !py-2 !text-[13px]"
                  >
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                      <option key={key} value={key}>{SORT_LABELS[key]}</option>
                    ))}
                  </select>
                </label>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => { setMinPrice(''); setMaxPrice(''); setSort('default'); }}
                    className="text-[12.5px] underline transition-colors text-[var(--muted)] hover:text-[var(--forest)]"
                  >
                    إعادة تعيين
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p style={{ color: 'var(--muted)' }}>جاري التحميل...</p>
            ) : visibleProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="mb-5" style={{ color: 'var(--muted)' }}>{q ? 'مفيش منتجات مطابقة للبحث.' : 'لا توجد منتجات مطابقة.'}</p>
                <Link href="/products" className="btn btn-secondary">عرض كل المنتجات</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {visibleProducts.map((p) => (
                  <ProductCard key={p.id} product={p} offer={offerByProductId.get(p.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-12">جاري التحميل...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
