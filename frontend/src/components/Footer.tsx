'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category } from '@/lib/api';
import { categoryLabel, ROUTINES_CATEGORY_ID, ROUTINES_CATEGORY_LABEL } from '@/lib/categories';
import Icon from './Icon';

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[19px] pb-2 mb-4 border-b"
      style={{ color: 'var(--cream)', borderColor: 'rgba(255,255,255,0.18)' }}
    >
      {children}
    </h3>
  );
}

export default function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  const linkClass = 'text-[rgba(255,255,255,0.78)] hover:text-white transition-colors';

  return (
    <footer style={{ background: 'var(--berry)', color: 'rgba(255,255,255,0.78)' }} className="mt-16">
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/ecobel-mark-white.png" alt="" style={{ height: 28, width: 'auto' }} />
            <span className="text-[28px] font-bold leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)' }}>
              Eco Bel
            </span>
          </div>
          <div className="text-[11px] font-bold mb-4" style={{ color: 'var(--gold-soft)' }}>طبيعي 100%</div>
          <p className="text-[13.5px] leading-relaxed mb-5">
            علامة مصرية للعناية بالبشرة والشعر، بتركيبات طبيعية وآمنة لجمال حقيقي وصحة مستدامة.
          </p>
          <div className="flex items-center gap-2.5">
            <a href="https://facebook.com/ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="فيسبوك" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.5 9.88v-6.99H7.9V12h2.6V9.8c0-2.56 1.53-3.98 3.87-3.98 1.12 0 2.3.2 2.3.2v2.5h-1.3c-1.28 0-1.68.8-1.68 1.61V12h2.86l-.46 2.89h-2.4v6.99A10 10 0 0 0 22 12Z" /></svg>
            </a>
            <a href="https://instagram.com/ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="إنستجرام" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href="https://tiktok.com/@ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="تيك توك" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.2c-.9-.8-1.4-1.9-1.5-3.2h-3.2v13.7c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6 0 .8.1V9.9c-.3 0-.5-.1-.8-.1-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V8.3c1.2.9 2.7 1.4 4.3 1.4V6.4c-1 0-2-.4-2.9-1.2Z" /></svg>
            </a>
          </div>
        </div>

        <div>
          <ColumnTitle>روابط سريعة</ColumnTitle>
          <div className="flex flex-col gap-2.5 text-[13.5px]">
            <Link href="/about" className={linkClass}>عن الشركة</Link>
            <Link href="/products" className={linkClass}>كل المنتجات</Link>
            <Link href="/track" className={linkClass}>تتبع طلبك</Link>
            <Link href="/account" className={linkClass}>حسابي</Link>
            <Link href="/wishlist" className={linkClass}>المفضلة</Link>
          </div>
        </div>

        <div>
          <ColumnTitle>الفئات</ColumnTitle>
          <div className="flex flex-col gap-2.5 text-[13.5px]">
            {categories.map((c) => (
              <Link key={c.id} href={`/products?category=${c.id}`} className={linkClass}>
                {categoryLabel(c.name)}
              </Link>
            ))}
            <Link href={`/products?category=${ROUTINES_CATEGORY_ID}`} className={linkClass}>
              {ROUTINES_CATEGORY_LABEL}
            </Link>
          </div>
        </div>

        <div>
          <ColumnTitle>تواصلي معنا</ColumnTitle>
          <div className="flex flex-col gap-3 text-[13.5px]">
            <span className="flex items-center gap-2">
              <Icon name="phone" size={16} />
              <span dir="ltr">01508582006</span>
            </span>
            <span className="flex items-center gap-2">
              <Icon name="pin" size={16} />
              المعادي، القاهرة
            </span>
            <span className="flex items-center gap-2">
              <Icon name="cash" size={16} />
              الدفع عند الاستلام
            </span>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
        <div className="mx-auto max-w-6xl px-5 py-4 text-[12.5px] flex flex-col sm:flex-row gap-2 justify-between" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span>© 2026 جميع الحقوق محفوظة لـ Eco Bel</span>
          <span className="flex items-center gap-1.5">
            <Icon name="leaf" size={14} />
            مكونات طبيعية · استبدال خلال 14 يوم
          </span>
        </div>
      </div>
    </footer>
  );
}
