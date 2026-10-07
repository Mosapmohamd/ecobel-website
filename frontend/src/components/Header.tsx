'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useAuth } from '@/lib/auth';
import { catalogApi, type Category } from '@/lib/api';
import { ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';
import Icon from './Icon';

const NAV = [
  { href: '/', label: 'الرئيسية', match: (p: string) => p === '/' },
  { href: '/products', label: 'كل المنتجات', match: (p: string) => p.startsWith('/products') },
  { href: ROUTINES_PATH, label: ROUTINES_LABEL, match: (p: string) => p.startsWith(ROUTINES_PATH) },
];
const NAV_AFTER = [
  { href: '/about', label: 'عن الشركة', match: (p: string) => p.startsWith('/about') },
  { href: '/track', label: 'تتبع طلبك', match: (p: string) => p.startsWith('/track') },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative py-2 text-label-lg transition-colors ${
        active ? 'font-bold text-primary' : 'font-medium text-ink-secondary hover:text-ink'
      }`}
    >
      {label}
      <span
        aria-hidden
        className={`absolute bottom-0 inset-x-0 h-[2px] bg-primary origin-right transition-transform ${active ? 'scale-x-100' : 'scale-x-0'}`}
      />
    </Link>
  );
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute top-0.5 left-0.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-primary text-surface text-[10px] font-bold leading-none">
      {n.toLocaleString('ar-EG')}
    </span>
  );
}

/** Desktop "الفئات" menu: opens on hover, on keyboard focus and on click/tap
 * (so touch screens wide enough for the desktop nav can open it too). */
function CategoriesMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass = 'block px-4 py-2.5 text-body-sm text-ink-secondary transition-colors hover:bg-surface-tint hover:text-primary';

  return (
    <div ref={ref} className="relative group h-full flex items-center" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 py-2 text-label-lg font-medium text-ink-secondary hover:text-ink transition-colors"
      >
        الفئات
        <Icon name="chevronDown" size={15} className={`transition-transform group-hover:rotate-180 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`absolute top-full right-0 z-20 w-60 pt-2 ${open ? 'block' : 'hidden'} group-hover:block group-focus-within:block`}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
      >
        <div className="rounded border border-line bg-surface py-2 shadow-raised">
          {categories.map((c) => (
            <Link key={c.id} href={`/products?category=${c.id}`} className={itemClass}>
              {c.name}
            </Link>
          ))}
          <Link href={ROUTINES_PATH} className={`${itemClass} border-t border-line`}>
            {ROUTINES_LABEL}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { customer, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    catalogApi.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setMobileMenuOpen(false);
    router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  }

  const searchBox = (
    <form onSubmit={handleSearch} className="relative w-full" role="search">
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted">
        <Icon name="search" size={17} />
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحثي عن منتج طبيعي..."
        aria-label="بحث في المنتجات"
        className="w-full h-10 pr-9 pl-3 rounded border border-transparent bg-surface-tint text-body-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:bg-surface focus:border-primary"
      />
    </form>
  );

  // A kept session counts even while its profile is still loading/unavailable.
  const accountHref = token ? '/account' : '/account/login';
  const accountLabel = token ? 'حسابي' : 'تسجيل الدخول';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface shadow-soft">
      <div className="page-container h-16 lg:h-20 flex items-center justify-between gap-4 lg:gap-6">
        <div className="flex items-center gap-2 flex-none">
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="xl:hidden flex items-center justify-center w-10 h-10 -mr-2 text-ink"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={22} />
          </button>

          <Link href="/" className="flex items-center gap-2.5" aria-label="Eco Bel — الصفحة الرئيسية">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/ecobel-mark-black.png" alt="" width={42} height={28} className="h-7 w-auto" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[26px] font-bold text-primary">Eco Bel</span>
              <span className="text-label-sm font-bold text-ink-muted mt-0.5">طبيعي 100%</span>
            </span>
          </Link>
        </div>

        <nav aria-label="القائمة الرئيسية" className="hidden xl:flex items-center gap-7 h-full flex-none">
          {NAV.map((n) => <NavLink key={n.href} href={n.href} label={n.label} active={n.match(pathname)} />)}
          {categories.length > 0 && <CategoriesMenu categories={categories} />}
          {NAV_AFTER.map((n) => <NavLink key={n.href} href={n.href} label={n.label} active={n.match(pathname)} />)}
        </nav>

        <div className="flex items-center justify-end gap-3 flex-1 min-w-0">
          <div className="hidden md:block w-full max-w-[240px]">{searchBox}</div>
          <div className="flex items-center gap-0.5 flex-none text-ink-secondary">
            <Link href="/wishlist" className="relative p-2 transition-colors hover:text-primary" aria-label={`المفضلة${wishCount ? ` (${wishCount})` : ''}`}>
              <Icon name="heart" size={22} />
              <CountBadge n={wishCount} />
            </Link>
            <Link href="/cart" className="relative p-2 transition-colors hover:text-primary" aria-label={`السلة${count ? ` (${count})` : ''}`}>
              <Icon name="bag" size={22} />
              <CountBadge n={count} />
            </Link>
            <Link href={accountHref} aria-label={accountLabel} className="flex items-center gap-2 p-1.5 mr-1 transition-colors hover:text-primary">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  customer ? 'bg-primary text-surface' : 'border border-line text-ink-secondary'
                }`}
              >
                <Icon name="user" size={17} />
              </span>
              {customer && (
                <span className="hidden 2xl:inline text-body-sm font-medium">أهلًا {customer.name.split(' ')[0]}</span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="md:hidden page-container pb-3">{searchBox}</div>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="xl:hidden border-t border-line bg-surface max-h-[calc(100dvh-8rem)] overflow-y-auto"
          onClick={(e) => (e.target as HTMLElement).closest('a') && setMobileMenuOpen(false)}
        >
          <div className="page-container py-4">
            <nav aria-label="القائمة الرئيسية" className="flex flex-col text-label-lg font-medium mb-5">
              {[...NAV, ...NAV_AFTER].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={n.match(pathname) ? 'page' : undefined}
                  className={`py-3 border-b border-line ${n.match(pathname) ? 'text-primary font-bold' : 'text-ink'}`}
                >
                  {n.label}
                </Link>
              ))}
              <Link href={accountHref} className="py-3 border-b border-line text-ink">
                {accountLabel}
              </Link>
            </nav>
            {categories.length > 0 && (
              <>
                <div className="text-label font-bold text-ink-muted mb-2.5">الفئات</div>
                <div className="flex flex-wrap gap-2 text-body-sm">
                  {categories.map((c) => (
                    <Link key={c.id} href={`/products?category=${c.id}`} className="px-3.5 py-2 rounded border border-line text-ink-secondary">
                      {c.name}
                    </Link>
                  ))}
                  <Link href={ROUTINES_PATH} className="px-3.5 py-2 rounded border border-line text-ink-secondary">
                    {ROUTINES_LABEL}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
