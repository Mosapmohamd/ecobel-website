'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useAuth } from '@/lib/auth';
import { catalogApi, type Category } from '@/lib/api';
import { categoryLabel, ROUTINES_CATEGORY_ID, ROUTINES_CATEGORY_LABEL } from '@/lib/categories';
import Icon from './Icon';

const NAV = [
  { href: '/', label: 'الرئيسية', match: (p: string) => p === '/' },
  { href: '/products', label: 'كل المنتجات', match: (p: string) => p.startsWith('/products') },
];
const NAV_AFTER = [
  { href: '/about', label: 'عن الشركة', match: (p: string) => p.startsWith('/about') },
  { href: '/track', label: 'تتبع طلبك', match: (p: string) => p.startsWith('/track') },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative py-2 transition-colors ${
        active ? 'font-bold text-[var(--forest)]' : 'font-medium text-[var(--muted-strong)] hover:text-[var(--ink)]'
      }`}
    >
      {label}
      <span
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-[2px] transition-transform origin-right"
        style={{ background: 'var(--forest)', transform: active ? 'scaleX(1)' : 'scaleX(0)' }}
      />
    </Link>
  );
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="absolute -top-1 -left-1 flex items-center justify-center rounded-full text-[10px] font-bold"
      style={{ minWidth: 17, height: 17, padding: '0 4px', background: 'var(--forest)', color: 'var(--cream)' }}
    >
      {n.toLocaleString('ar-EG')}
    </span>
  );
}

export default function Header() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { customer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  }

  const searchBox = (
    <form onSubmit={handleSearch} className="relative w-full" role="search">
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }}>
        <Icon name="search" size={17} />
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحثي عن منتج طبيعي..."
        aria-label="بحث"
        className="w-full h-10 pr-9 pl-3 rounded text-[13.5px] outline-none transition-colors focus:bg-white"
        style={{ background: 'var(--parchment)', border: '1px solid transparent' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--forest)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      />
    </form>
  );

  return (
    <header
      className="sticky z-40 border-b"
      style={{ top: 'env(safe-area-inset-top, 0px)', background: 'var(--cream)', borderColor: 'var(--line)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
    >
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-5">
        <button
          type="button"
          aria-label="القائمة"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="lg:hidden flex-none flex items-center justify-center w-9 h-9"
          style={{ color: 'var(--ink)' }}
        >
          <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={22} />
        </button>

        <Link href="/" className="flex items-center gap-2 flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/ecobel-mark-black.png" alt="" width={34} height={23} style={{ height: 28, width: 'auto' }} />
          <span className="flex flex-col leading-none">
            <span className="text-[26px] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Eco Bel</span>
            <span className="text-[10.5px] font-bold mt-0.5" style={{ color: 'var(--forest)' }}>طبيعي 100%</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-[15px] h-full flex-none">
          {NAV.map((n) => <NavLink key={n.href} href={n.href} label={n.label} active={n.match(pathname)} />)}

          {categories.length > 0 && (
            <div className="relative group h-full flex items-center">
              <button className="flex items-center gap-1 cursor-default py-2" style={{ color: 'var(--muted-strong)', fontWeight: 500 }}>
                الفئات
                <Icon name="chevronDown" size={14} className="transition-transform group-hover:rotate-180" />
              </button>
              <div className="absolute top-full right-0 hidden group-hover:block z-20" style={{ minWidth: 220 }}>
                <div
                  className="rounded border py-2 bg-white"
                  style={{ borderColor: 'var(--line)', boxShadow: '0 4px 16px -2px rgba(43,35,32,0.06), 0 1px 3px rgba(43,35,32,0.03)' }}
                >
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/products?category=${c.id}`}
                      className="block px-4 py-2 text-[14px] text-[var(--muted-strong)] transition-colors hover:bg-[var(--parchment)] hover:text-[var(--forest)]"
                    >
                      {categoryLabel(c.name)}
                    </Link>
                  ))}
                  <Link
                    href={`/products?category=${ROUTINES_CATEGORY_ID}`}
                    className="block px-4 py-2 text-[14px] text-[var(--muted-strong)] border-t transition-colors hover:bg-[var(--parchment)] hover:text-[var(--forest)]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {ROUTINES_CATEGORY_LABEL}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {NAV_AFTER.map((n) => <NavLink key={n.href} href={n.href} label={n.label} active={n.match(pathname)} />)}
        </nav>

        <div className="hidden sm:block flex-1 max-w-[260px]">{searchBox}</div>

        <div className="flex items-center gap-1 flex-none" style={{ color: 'var(--muted-strong)' }}>
          <Link href="/wishlist" className="relative p-2 transition-colors hover:text-[var(--forest)]" aria-label="المفضلة">
            <Icon name="heart" size={22} />
            <CountBadge n={wishCount} />
          </Link>
          <Link href="/cart" className="relative p-2 transition-colors hover:text-[var(--forest)]" aria-label="السلة">
            <Icon name="bag" size={22} />
            <CountBadge n={count} />
          </Link>
          <Link
            href={customer ? '/account' : '/account/login'}
            className="relative p-2 flex items-center gap-1.5 transition-colors hover:text-[var(--forest)]"
            aria-label={customer ? 'حسابي' : 'تسجيل الدخول'}
          >
            <Icon name="user" size={22} />
            {customer && (
              <span className="hidden xl:inline text-[13.5px] font-medium">أهلًا {customer.name.split(' ')[0]}</span>
            )}
          </Link>
        </div>
      </div>

      <div className="sm:hidden px-5 pb-3">{searchBox}</div>

      {/* Mobile menu: primary nav + categories (desktop uses the hover nav above) */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden border-t px-5 py-4 max-h-[70vh] overflow-y-auto"
          style={{ borderColor: 'var(--line)' }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setMobileMenuOpen(false);
          }}
        >
          <nav className="flex flex-col text-[15px] font-medium mb-4">
            {[...NAV, ...NAV_AFTER].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="py-2.5 border-b"
                style={{ borderColor: 'var(--line)', color: n.match(pathname) ? 'var(--forest)' : 'var(--ink)' }}
              >
                {n.label}
              </Link>
            ))}
            <Link href={customer ? '/account' : '/account/login'} className="py-2.5 border-b" style={{ borderColor: 'var(--line)' }}>
              {customer ? 'حسابي' : 'تسجيل الدخول'}
            </Link>
          </nav>
          {categories.length > 0 && (
            <>
              <div className="text-[12.5px] font-bold mb-2" style={{ color: 'var(--sage)' }}>الفئات</div>
              <div className="flex flex-wrap gap-2 text-[13.5px]">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/products?category=${c.id}`}
                    className="px-3 py-1.5 rounded border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {categoryLabel(c.name)}
                  </Link>
                ))}
                <Link
                  href={`/products?category=${ROUTINES_CATEGORY_ID}`}
                  className="px-3 py-1.5 rounded border"
                  style={{ borderColor: 'var(--line)' }}
                >
                  {ROUTINES_CATEGORY_LABEL}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
