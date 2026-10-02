'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { catalogApi, type Category, type Product, type Offer, type Routine } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import RoutineCard from '@/components/RoutineCard';
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

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl mb-2">
        {q ? `نتائج البحث عن "${q}"` : isRoutinesView ? ROUTINES_CATEGORY_LABEL : 'كل المنتجات'}
      </h1>
      {q && (
        <a href="/products" className="text-sm font-bold mb-6 inline-block" style={{ color: 'var(--forest)' }}>
          ← عرض كل المنتجات
        </a>
      )}

      <div className="flex flex-wrap gap-2 mb-8 mt-4">
        <a href={q ? `/products?q=${encodeURIComponent(q)}` : '/products'} className="btn" style={{ background: !categoryId ? 'var(--forest)' : 'var(--parchment-2)', color: !categoryId ? 'var(--cream)' : 'var(--forest)' }}>
          الكل
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/products?category=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className="btn"
            style={{ background: categoryId === c.id ? 'var(--forest)' : 'var(--parchment-2)', color: categoryId === c.id ? 'var(--cream)' : 'var(--forest)' }}
          >
            {categoryLabel(c.name)}
          </a>
        ))}
        {routines.length > 0 && (
          <a
            href={`/products?category=${ROUTINES_CATEGORY_ID}`}
            className="btn"
            style={{ background: isRoutinesView ? 'var(--forest)' : 'var(--parchment-2)', color: isRoutinesView ? 'var(--cream)' : 'var(--forest)' }}
          >
            {ROUTINES_CATEGORY_LABEL}
          </a>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {routines.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p className="text-[13.5px]" style={{ color: 'var(--muted)' }}>
              {loading ? '' : `${visibleProducts.length.toLocaleString('ar-EG')} منتج`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} placeholder="من" value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-20"
                  style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '7px 8px', fontSize: 13 }}
                />
                <span className="text-[13px]" style={{ color: 'var(--muted)' }}>—</span>
                <input
                  type="number" min={0} placeholder="إلى" value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-20"
                  style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '7px 8px', fontSize: 13 }}
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '8px 10px', fontSize: 13 }}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--muted)' }}>جاري التحميل...</p>
          ) : visibleProducts.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>{q ? 'مفيش منتجات مطابقة للبحث.' : 'لا توجد منتجات مطابقة.'}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {visibleProducts.map((p) => (
                <ProductCard key={p.id} product={p} offer={offerByProductId.get(p.id)} />
              ))}
            </div>
          )}
        </>
      )}
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
