'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category, type Product } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([catalogApi.categories(), catalogApi.products()])
      .then(([c, p]) => {
        setCategories(c);
        setProducts(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, var(--forest) 0%, var(--forest-deep) 100%)` }}>
        <div className="mx-auto max-w-6xl px-5 py-20 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>
              مكونات طبيعية · تركيبات آمنة
            </div>
            <h1 className="text-4xl md:text-5xl font-bold" style={{ color: 'var(--cream)' }}>
              جمالك يبدأ من عناية نقية
            </h1>
            <p className="mt-4 text-[17px] max-w-md" style={{ color: 'rgba(251,249,244,0.82)' }}>
              منتجات Eco Bel للعناية بالبشرة والشعر، مصنوعة من مكونات طبيعية لنتائج فعّالة تدوم.
            </p>
            <Link href="/products" className="btn btn-gold mt-7">تسوقي الآن</Link>
          </div>
          <div className="flex-1 flex justify-center">
            <svg viewBox="0 0 220 260" width="240">
              <ellipse cx="110" cy="240" rx="70" ry="10" fill="#00000022" />
              <rect x="55" y="70" width="110" height="150" rx="14" fill="#E9E2CE" />
              <rect x="70" y="40" width="80" height="40" rx="10" fill="#C9A227" />
              <rect x="88" y="20" width="44" height="26" rx="6" fill="#8FA888" />
              <rect x="70" y="120" width="80" height="46" rx="4" fill="#1F3A2E" opacity="0.85" />
            </svg>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b" style={{ background: 'var(--parchment-2)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-4 flex flex-wrap justify-between gap-4 text-[14px] font-medium" style={{ color: 'var(--forest)' }}>
          <span>🚚 شحن لكل المحافظات</span>
          <span>💵 الدفع عند الاستلام</span>
          <span>🌿 مكونات طبيعية 100%</span>
          <span>↩️ استبدال خلال 14 يوم</span>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-sm font-bold mb-2" style={{ color: 'var(--forest)' }}>تسوّقي حسب احتياجك</div>
          <h2 className="text-3xl mb-8">فئات المنتجات</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.id}`}
                className="rounded-lg p-8 flex items-end min-h-[140px]"
                style={{ background: 'linear-gradient(160deg,#DCE7D6 0%, #B9CDAF 100%)' }}
              >
                <span className="text-xl font-bold" style={{ color: 'var(--forest-deep)' }}>{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-sm font-bold mb-2" style={{ color: 'var(--forest)' }}>الأكثر طلبًا</div>
            <h2 className="text-3xl">منتجات مختارة لكِ</h2>
          </div>
          <Link href="/products" className="text-sm font-bold" style={{ color: 'var(--forest)' }}>عرض الكل ←</Link>
        </div>

        {loading ? (
          <p style={{ color: '#8a8074' }}>جاري التحميل...</p>
        ) : products.length === 0 ? (
          <p style={{ color: '#8a8074' }}>لا توجد منتجات متاحة حاليًا.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
