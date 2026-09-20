'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';

export default function Header() {
  const { count } = useCart();

  return (
    <header>
      <div style={{ background: 'var(--forest)', color: 'rgba(251,249,244,0.85)' }}>
        <div className="mx-auto max-w-6xl px-5 py-2 flex items-center justify-between text-[13px]">
          <span>شحن لكل المحافظات 🚚 — الشحن مجانًا فوق 1000 جنيه</span>
          <span>01508582006</span>
        </div>
      </div>
      <div className="border-b" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9 6 7 9 7 13a5 5 0 0 0 10 0c0-4-2-7-5-11Z" fill="var(--gold)" />
            </svg>
            Eco Bel
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium">
            <Link href="/">الرئيسية</Link>
            <Link href="/products">كل المنتجات</Link>
            <Link href="/track">تتبع طلبك</Link>
          </nav>

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
    </header>
  );
}
