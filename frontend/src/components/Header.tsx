'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useAuth } from '@/lib/auth';
import { catalogApi, type Category } from '@/lib/api';

export default function Header() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { customer } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header>
      <div className="border-b" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold flex-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/ecobel-mark-black.png" alt="" width={34} height={23} style={{ height: 30, width: 'auto' }} />
            Eco Bel
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-[15px] font-medium flex-none">
            <Link href="/">الرئيسية</Link>
            <Link href="/products">كل المنتجات</Link>

            {categories.length > 0 && (
              <div className="relative group">
                <button className="flex items-center gap-1 cursor-default">
                  الفئات
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  className="absolute top-full right-0 pt-3 hidden group-hover:block z-20"
                  style={{ minWidth: 220 }}
                >
                  <div className="rounded border shadow-lg py-2" style={{ background: '#fff', borderColor: 'var(--line)' }}>
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={`/products?category=${c.id}`}
                        className="block px-5 py-2.5 text-[14px] hover:opacity-70"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Link href="/about">عن الشركة</Link>
            <Link href="/track">تتبع طلبك</Link>
          </nav>

          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحثي عن منتج..."
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', fontSize: 13.5, width: '100%', background: '#fff' }}
            />
          </form>

          <div className="flex items-center gap-5 flex-none">
            <Link href={customer ? '/account' : '/account/login'} className="text-[14px] font-medium hidden sm:inline" style={{ color: 'var(--forest)' }}>
              {customer ? `أهلًا ${customer.name.split(' ')[0]}` : 'تسجيل الدخول'}
            </Link>
            <Link href="/wishlist" className="relative flex items-center" aria-label="المفضلة">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2">
                <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
              </svg>
              {wishCount > 0 && (
                <span
                  className="absolute -top-2 -left-2 flex items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ width: 17, height: 17, background: 'var(--gold)', color: 'var(--forest-deep)' }}
                >
                  {wishCount}
                </span>
              )}
            </Link>
            <Link href="/cart" className="relative flex items-center" aria-label="السلة">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2">
                <path d="M3 6h2l2.4 12.2a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.6L21 8H6" />
                <circle cx="10" cy="21" r="1" />
                <circle cx="17" cy="21" r="1" />
              </svg>
              {count > 0 && (
                <span
                  className="absolute -top-2 -left-2 flex items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ width: 17, height: 17, background: 'var(--gold)', color: 'var(--forest-deep)' }}
                >
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Search on small screens */}
        <form onSubmit={handleSearch} className="sm:hidden px-5 pb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحثي عن منتج..."
            style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', fontSize: 13.5, width: '100%', background: '#fff' }}
          />
        </form>
      </div>
    </header>
  );
}
