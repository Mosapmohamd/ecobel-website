'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist';
import ProductCard from '@/components/ProductCard';
import { catalogApi, type Offer } from '@/lib/api';

export default function WishlistPage() {
  const { items } = useWishlist();
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    catalogApi.offers().then(setOffers).catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h1 className="text-[28px] mb-2">المفضلة فاضية</h1>
        <p style={{ color: 'var(--muted)' }} className="mb-6">دوسي على أيقونة القلب على أي منتج عشان تضيفيه هنا.</p>
        <Link href="/products" className="btn btn-primary">تصفّحي المنتجات</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <span className="kicker">حسابي</span>
      <h1 className="text-[30px] lg:text-[40px] leading-tight mb-8">المفضلة</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} offer={offers.find((o) => o.product_id === p.id)} />
        ))}
      </div>
    </div>
  );
}
