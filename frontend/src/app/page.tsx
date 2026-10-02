'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category, type Product, type Offer, type Routine } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import OfferCard from '@/components/OfferCard';
import RoutineCard from '@/components/RoutineCard';
import HeroBanner from '@/components/HeroBanner';
import CategoryIconRow from '@/components/CategoryIconRow';
import TrustStrip from '@/components/TrustStrip';
import BrandStory from '@/components/BrandStory';
import HomeReviews from '@/components/HomeReviews';
import { ROUTINES_CATEGORY_ID } from '@/lib/categories';

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([catalogApi.categories(), catalogApi.products(), catalogApi.offers(), catalogApi.routines()])
      .then(([c, p, o, r]) => {
        setCategories(c);
        setProducts(p);
        setOffers(o);
        setRoutines(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Prefer a real offer/product photo for the hero; otherwise the hero
  // renders its no-image layout. Computed from data already being fetched
  // above — no extra request.
  const heroImage = useMemo(() => {
    const withPhoto = offers.find((o) => o.image_url) ?? products.find((p) => p.image_url);
    if (!withPhoto) return null;
    return {
      url: withPhoto.image_url as string,
      alt: 'product_name' in withPhoto ? withPhoto.product_name : withPhoto.name,
    };
  }, [offers, products]);

  const reviewProductIds = useMemo(() => {
    const ids = [...offers.map((o) => o.product_id), ...products.map((p) => p.id)];
    return Array.from(new Set(ids)).slice(0, 3);
  }, [offers, products]);

  // Homepage merchandising shows only 2 routines — chosen by total bundle
  // value (highest first), the one signal in the real routine data that's
  // a reasonable "feature this" proxy. The rest stay fully browsable via
  // the "الروتين" category on /products.
  const featuredRoutines = useMemo(() => {
    const total = (r: Routine) => r.items.reduce((sum, it) => sum + it.sale_price, 0);
    return [...routines].sort((a, b) => total(b) - total(a)).slice(0, 2);
  }, [routines]);

  return (
    <div>
      <HeroBanner imageUrl={heroImage?.url} imageAlt={heroImage?.alt} />

      <TrustStrip />

      <CategoryIconRow categories={categories} routinesCount={routines.length} />

      {/* Offers */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-8">
            <span className="kicker" style={{ color: 'var(--rose)' }}>لفترة محدودة</span>
            <h2 className="text-[28px] lg:text-[40px] leading-tight">العروض والتخفيضات</h2>
            <p className="mt-2 text-[15px]" style={{ color: 'var(--muted)' }}>
              أفضل منتجاتنا بأسعار مخفضة لفترة محدودة.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        </section>
      )}

      {/* Routines */}
      {featuredRoutines.length > 0 && (
        <section style={{ background: 'var(--parchment)' }}>
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div>
                <span className="kicker">مجموعات مختارة بعناية</span>
                <h2 className="text-[28px] lg:text-[40px] leading-tight">روتين العناية المتكامل</h2>
                <p className="mt-2 text-[15px]" style={{ color: 'var(--muted)' }}>
                  خطوات متناغمة لنتائج واضحة — أضيفي الروتين كامل للسلة بضغطة واحدة.
                </p>
              </div>
              <Link
                href={`/products?category=${ROUTINES_CATEGORY_ID}`}
                className="text-[13.5px] font-bold link-underline flex-none"
                style={{ color: 'var(--forest)' }}
              >
                كل الروتينات
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredRoutines.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <span className="kicker">الأكثر طلبًا</span>
            <h2 className="text-[28px] lg:text-[40px] leading-tight">منتجات مختارة لكِ</h2>
          </div>
          <Link href="/products" className="text-[13.5px] font-bold link-underline flex-none" style={{ color: 'var(--forest)' }}>
            مشاهدة الكل
          </Link>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>جاري التحميل...</p>
        ) : products.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>لا توجد منتجات متاحة حاليًا.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} offer={offers.find((o) => o.product_id === p.id)} />
            ))}
          </div>
        )}
      </section>

      <HomeReviews productIds={reviewProductIds} />

      <BrandStory />
    </div>
  );
}
