'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category, type Product } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import HeroBanner from '@/components/HeroBanner';

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
      <HeroBanner />

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
