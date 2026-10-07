'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import { catalogApi, type Product } from '@/lib/api';

export default function WishlistPage() {
  const { ids } = useWishlist();
  const key = useMemo(() => ids.join(','), [ids]);
  // Products are loaded fresh by id, so price and availability are current.
  const [loaded, setLoaded] = useState<{ key: string; products: Product[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.allSettled(key.split(',').map((id) => catalogApi.product(id))).then((results) => {
      if (cancelled) return;
      // A product staff removed from the store (404) simply drops out.
      const products = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      setLoaded({ key, products });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (ids.length === 0) {
    return (
      <div className="page-container py-20 text-center">
        <h1 className="text-headline-md mb-2">المفضلة فاضية</h1>
        <p className="text-body text-ink-muted mb-6">دوسي على أيقونة القلب على أي منتج عشان تضيفيه هنا.</p>
        <Link href="/products" className="btn btn-primary">تصفّحي المنتجات</Link>
      </div>
    );
  }

  // Keep the wishlist's own order; while a change reloads, show what we have.
  const products = loaded ? ids.flatMap((id) => loaded.products.filter((p) => p.id === id)) : null;

  return (
    <div className="page-container py-12">
      <h1 className="text-headline-md lg:text-headline-lg mb-8">المفضلة</h1>
      {products === null ? (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6" aria-busy="true">
          <span className="sr-only" role="status">جاري تحميل المفضلة...</span>
          {ids.slice(0, 4).map((id) => <ProductCardSkeleton key={id} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-body text-ink-muted mb-6">المنتجات اللي في المفضلة مبقتش متاحة في المتجر.</p>
          <Link href="/products" className="btn btn-primary">تصفّحي المنتجات</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
