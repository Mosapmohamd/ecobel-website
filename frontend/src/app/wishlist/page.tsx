'use client';

import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist';
import ProductCard from '@/components/ProductCard';

export default function WishlistPage() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h1 className="text-2xl mb-3">المفضلة فاضية</h1>
        <p style={{ color: '#8a8074' }} className="mb-6">دوسي على أيقونة القلب على أي منتج عشان تضيفيه هنا.</p>
        <Link href="/products" className="btn btn-primary">تصفّحي المنتجات</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl mb-8">المفضلة</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
