import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Category } from '@/lib/api';

const ICONS: { match: RegExp; icon: (p: { color: string }) => ReactElement }[] = [
  {
    match: /بشرة/,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
      </svg>
    ),
  },
  {
    match: /شعر/,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 2C9 6 7 9 7 13a5 5 0 0 0 10 0c0-4-2-7-5-11Z" />
        <path d="M9.5 13a2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    match: /عطر|عطو|سبلاش|برفان/,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M9 2h6M10 2v4.2a3 3 0 0 1-.9 2.1L8 9.4A4 4 0 0 0 6.8 12.3V20a2 2 0 0 0 2 2h6.4a2 2 0 0 0 2-2v-7.7a4 4 0 0 0-1.2-2.9l-1.1-1.1a3 3 0 0 1-.9-2.1V2" />
      </svg>
    ),
  },
  {
    match: /جسم|يد|قدم/,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
];

const DEFAULT_ICON = ({ color }: { color: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
  </svg>
);

function iconFor(name: string) {
  return ICONS.find((i) => i.match.test(name))?.icon ?? DEFAULT_ICON;
}

export default function CategoryIconRow({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section style={{ background: 'var(--parchment)' }} className="border-b" >
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl">تسوّقي حسب الفئة</h2>
          <Link href="/products" className="text-sm font-bold" style={{ color: 'var(--forest)' }}>
            كل الفئات ←
          </Link>
        </div>
        <div className="flex flex-wrap justify-around gap-6">
          {categories.map((c) => {
            const Icon = iconFor(c.name);
            return (
              <Link
                key={c.id}
                href={`/products?category=${c.id}`}
                className="flex flex-col items-center gap-3 text-center"
              >
                <Icon color="var(--forest)" />
                <div>
                  <div className="text-[15px] font-bold">{c.name}</div>
                  <div className="text-[12.5px]" style={{ color: '#8a8074' }}>
                    {c.product_count.toLocaleString('ar-EG')} منتج
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
