'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { catalogApi, type Category, type Product } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

function ProductsContent() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get('category') || undefined;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    catalogApi
      .products(categoryId)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categoryId]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl mb-8">كل المنتجات</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        <a href="/products" className="btn" style={{ background: !categoryId ? 'var(--forest)' : 'var(--parchment-2)', color: !categoryId ? 'var(--cream)' : 'var(--forest)' }}>
          الكل
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={`/products?category=${c.id}`}
            className="btn"
            style={{ background: categoryId === c.id ? 'var(--forest)' : 'var(--parchment-2)', color: categoryId === c.id ? 'var(--cream)' : 'var(--forest)' }}
          >
            {c.name}
          </a>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#8a8074' }}>جاري التحميل...</p>
      ) : products.length === 0 ? (
        <p style={{ color: '#8a8074' }}>لا توجد منتجات في هذه الفئة حاليًا.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
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
