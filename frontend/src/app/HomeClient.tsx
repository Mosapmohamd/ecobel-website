'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category, type Product, type Routine } from '@/lib/api';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import RoutineCard from '@/components/RoutineCard';
import HeroCarousel from '@/components/HeroCarousel';
import CategoryIconRow from '@/components/CategoryIconRow';
import TrustStrip from '@/components/TrustStrip';
import BrandStory from '@/components/BrandStory';
import HomeReviews from '@/components/HomeReviews';
import ClosingCta from '@/components/ClosingCta';
import SectionHeader from '@/components/SectionHeader';
import { HOME_OFFERS_SHOWN, ROUTINES_PATH } from '@/lib/constants';
import { HERO_SLIDES, buildHeroSlides } from '@/lib/heroSlides';

type Tone = 'surface' | 'tint';
const productGrid = 'grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6';

export interface HomeData {
  categories: Category[];
  /** Exactly what staff featured in the accounting system, in order. */
  featured: Product[];
  featuredRoutines: Routine[];
  offers: Product[];
  routineCount: number;
}

/** The homepage. Rendered on the server with `initialData` (so first paint
 * and search engines get the real content); if that's missing it loads in
 * the browser exactly as before. */
export default function HomeClient({ initialData }: { initialData: HomeData | null }) {
  const [data, setData] = useState<HomeData | null>(initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialData && attempt === 0) return; // already rendered on the server
    let cancelled = false;
    Promise.all([
      catalogApi.categories(),
      catalogApi.featuredProducts(),
      catalogApi.featuredRoutines(),
      catalogApi.products({ onOffer: true, limit: HOME_OFFERS_SHOWN }),
      catalogApi.routines(),
    ])
      .then(([categories, featured, featuredRoutines, offers, routines]) => {
        if (cancelled) return;
        setData({ categories, featured, featuredRoutines, offers: offers.items, routineCount: routines.length });
        setLoadError(null);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'تعذر تحميل المنتجات'));
    return () => {
      cancelled = true;
    };
  }, [attempt, initialData]);

  const heroSlides = useMemo(() => buildHeroSlides(HERO_SLIDES, data?.categories ?? []), [data]);
  const reviewProductIds = useMemo(() => (data?.featured ?? []).map((p) => p.id).slice(0, 3), [data]);

  const loading = data === null && loadError === null;
  const featured = data?.featured ?? [];
  const offers = data?.offers ?? [];
  const featuredRoutines = data?.featuredRoutines ?? [];

  // Alternate section backgrounds over the sections actually shown, so two
  // tinted sections never sit next to each other.
  const shownSections = [
    'categories',
    ...(offers.length > 0 ? ['offers'] : []),
    ...(loading || loadError || featured.length > 0 ? ['featured'] : []),
    ...(featuredRoutines.length > 0 ? ['routines'] : []),
    'brand',
    'reviews',
  ];
  const toneOf = (key: string): Tone => (shownSections.indexOf(key) % 2 === 0 ? 'tint' : 'surface');
  const bg = (t: Tone) => (t === 'tint' ? 'bg-surface-tint' : 'bg-surface');

  return (
    <div>
      <HeroCarousel slides={heroSlides} />

      <TrustStrip />

      <CategoryIconRow categories={data?.categories ?? []} routinesCount={data?.routineCount ?? 0} tone={toneOf('categories')} />

      {offers.length > 0 && (
        <section id="offers" aria-labelledby="home-offers" className={`section scroll-mt-24 ${bg(toneOf('offers'))}`}>
          <div className="page-container">
            <SectionHeader
              id="home-offers"
              kicker="لفترة محدودة"
              kickerTone="sale"
              title="العروض والتخفيضات"
              description="أسعار مخفضة على مختارات من منتجاتنا لفترة محدودة."
              link={{ href: '/products?offers=1', label: 'كل العروض' }}
            />
            <div className={productGrid}>
              {offers.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Featured products — only the staff selection. Fewer than 8 → fewer
          cards; none → the section is hidden (never filled automatically). */}
      {(loading || loadError || featured.length > 0) && (
        <section aria-labelledby="home-featured" className={`section ${bg(toneOf('featured'))}`}>
          <div className="page-container">
            <SectionHeader
              id="home-featured"
              kicker="مختارات Eco Bel"
              title="منتجات مختارة لكِ"
              link={{ href: '/products', label: 'مشاهدة الكل' }}
            />
            {loading ? (
              <div className={productGrid} aria-busy="true">
                <span className="sr-only" role="status">جاري تحميل المنتجات...</span>
                {Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : loadError ? (
              <div role="alert" className="notice notice-error flex flex-wrap items-center justify-between gap-3">
                <span>{loadError}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoadError(null); setAttempt((n) => n + 1); }}>
                  حاولي تاني
                </button>
              </div>
            ) : (
              <div className={productGrid}>
                {featured.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {featuredRoutines.length > 0 && (
        <section aria-labelledby="home-routines" className={`section ${bg(toneOf('routines'))}`}>
          <div className="page-container">
            <SectionHeader
              id="home-routines"
              align="center"
              kicker="مجموعات مختارة بعناية"
              title="روتين العناية المتكامل"
              description="خطوات متناغمة لنتيجة أوضح — أضيفي الروتين كامل للسلة بضغطة واحدة."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {featuredRoutines.map((r) => <RoutineCard key={r.id} routine={r} />)}
            </div>
            {(data?.routineCount ?? 0) > featuredRoutines.length && (
              <div className="mt-8 text-center">
                <Link href={ROUTINES_PATH} className="btn btn-secondary">
                  كل الروتينات ({(data?.routineCount ?? 0).toLocaleString('ar-EG')})
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <BrandStory tone={toneOf('brand')} />

      <HomeReviews productIds={reviewProductIds} tone={toneOf('reviews')} />

      <ClosingCta />
    </div>
  );
}
