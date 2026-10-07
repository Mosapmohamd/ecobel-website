'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogApi, type Category } from '@/lib/api';
import { FREE_SHIPPING_THRESHOLD, ROUTINES_LABEL, ROUTINES_PATH, SITE_CONTACT } from '@/lib/constants';
import Icon from './Icon';

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-headline-sm text-surface pb-2 mb-4 border-b border-surface/20">{children}</h2>;
}

const linkClass = 'text-surface/80 hover:text-surface transition-colors';

export default function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  return (
    <footer className="mt-16 bg-brand-deep text-surface/80">
      <div className="page-container pt-14 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/ecobel-mark-white.png" alt="" className="h-7 w-auto" />
            <span className="font-display text-[30px] font-bold leading-none text-surface">Eco Bel</span>
            <span className="badge bg-primary text-surface">طبيعي 100%</span>
          </div>
          <p className="text-body-sm leading-relaxed mb-5">
            علامة مصرية للعناية بالبشرة والشعر، بتركيبات طبيعية وآمنة لجمال حقيقي وصحة مستدامة.
          </p>
          <div className="flex items-center gap-2.5">
            <a href={SITE_CONTACT.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Eco Bel على فيسبوك" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.5 9.88v-6.99H7.9V12h2.6V9.8c0-2.56 1.53-3.98 3.87-3.98 1.12 0 2.3.2 2.3.2v2.5h-1.3c-1.28 0-1.68.8-1.68 1.61V12h2.86l-.46 2.89h-2.4v6.99A10 10 0 0 0 22 12Z" /></svg>
            </a>
            <a href={SITE_CONTACT.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Eco Bel على إنستجرام" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href={SITE_CONTACT.social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="Eco Bel على تيك توك" className="social">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.2c-.9-.8-1.4-1.9-1.5-3.2h-3.2v13.7c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6 0 .8.1V9.9c-.3 0-.5-.1-.8-.1-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V8.3c1.2.9 2.7 1.4 4.3 1.4V6.4c-1 0-2-.4-2.9-1.2Z" /></svg>
            </a>
          </div>
        </div>

        <nav aria-label="روابط سريعة">
          <ColumnTitle>روابط سريعة</ColumnTitle>
          <ul className="flex flex-col gap-2.5 text-body-sm">
            <li><Link href="/about" className={linkClass}>عن الشركة</Link></li>
            <li><Link href="/products" className={linkClass}>كل المنتجات</Link></li>
            <li><Link href="/track" className={linkClass}>تتبع طلبك</Link></li>
            <li><Link href="/account" className={linkClass}>حسابي</Link></li>
            <li><Link href="/wishlist" className={linkClass}>المفضلة</Link></li>
          </ul>
        </nav>

        <nav aria-label="الفئات">
          <ColumnTitle>الفئات</ColumnTitle>
          <ul className="flex flex-col gap-2.5 text-body-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/products?category=${c.id}`} className={linkClass}>{c.name}</Link>
              </li>
            ))}
            <li>
              <Link href={ROUTINES_PATH} className={linkClass}>{ROUTINES_LABEL}</Link>
            </li>
          </ul>
        </nav>

        <div>
          <ColumnTitle>تواصلي معنا</ColumnTitle>
          <ul className="flex flex-col gap-3 text-body-sm">
            <li>
              <a href={SITE_CONTACT.phoneHref} className={`flex items-center gap-2 ${linkClass}`}>
                <Icon name="phone" size={16} />
                <span dir="ltr">{SITE_CONTACT.phone}</span>
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="pin" size={16} />
              {SITE_CONTACT.address}
            </li>
          </ul>
          <div className="mt-6">
            <span className="block text-label font-bold text-surface mb-2">طريقة الدفع</span>
            <span className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-label text-surface">
              <Icon name="cash" size={15} />
              الدفع عند الاستلام
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-surface/15">
        <div className="page-container py-5 text-label flex flex-col sm:flex-row gap-2 justify-between text-surface/65">
          <span>© {new Date().getFullYear()} جميع الحقوق محفوظة لـ Eco Bel</span>
          <span className="flex items-center gap-1.5">
            <Icon name="truck" size={14} />
            شحن مجاني للطلبات فوق {FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م
          </span>
        </div>
      </div>
    </footer>
  );
}
