import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Category } from '@/lib/api';
import { categoryLabel, ROUTINES_CATEGORY_ID, ROUTINES_CATEGORY_LABEL } from '@/lib/categories';

type IconFn = (p: { color: string }) => ReactElement;

// Catalog category names come back in English from the API (e.g. "Skin
// Care") — matched case-insensitively, with the original Arabic terms kept
// as a fallback in case any category is ever named in Arabic.
const ICONS: { match: RegExp; icon: IconFn }[] = [
  {
    match: /skin|بشرة/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
      </svg>
    ),
  },
  {
    match: /hair|شعر/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 2C9 6 7 9 7 13a5 5 0 0 0 10 0c0-4-2-7-5-11Z" />
        <path d="M9.5 13a2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    match: /^men|men's|رجال/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="8" r="4" />
        <path d="M8 10.5c-.6 1-1 2.3-1 3.5 0 2.5 2.2 4.5 5 4.5s5-2 5-4.5c0-1.2-.4-2.5-1-3.5" />
      </svg>
    ),
  },
  {
    match: /bath|shower|استحمام/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M4 12V8a2 2 0 0 1 2-2" />
        <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3Z" />
        <path d="M7 22h10" />
        <circle cx="9" cy="4" r="1" fill={color} stroke="none" />
        <circle cx="13" cy="3" r="0.8" fill={color} stroke="none" />
      </svg>
    ),
  },
  {
    match: /gift|wellness|هداي|عافية/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <rect x="4" y="9" width="16" height="11" rx="1.5" />
        <path d="M2 9h20v3.5H2z" />
        <path d="M12 9v11" />
        <path d="M12 9C10.5 6 7 6 7 8.5S9.5 9.5 12 9Zm0 0c1.5-3 5-3 5 .5S14.5 9.5 12 9Z" />
      </svg>
    ),
  },
  {
    match: /body|جسم|يد|قدم/i,
    icon: ({ color }) => (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
];

const ROUTINES_ICON: IconFn = ({ color }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
    <rect x="3.5" y="3.5" width="11" height="11" rx="2" />
    <rect x="9.5" y="9.5" width="11" height="11" rx="2" />
  </svg>
);

// A plain tag glyph — used only for a category outside the known set
// above, never shown as every category's icon (that read as a stuck
// loading spinner before the English-name matching was fixed).
const DEFAULT_ICON: IconFn = ({ color }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
    <path d="M3 11V5a2 2 0 0 1 2-2h6l10 10a2 2 0 0 1 0 2.83l-6.34 6.34a2 2 0 0 1-2.82 0L3 12.83" />
    <circle cx="7.5" cy="7.5" r="1.2" fill={color} stroke="none" />
  </svg>
);

function iconFor(name: string): IconFn {
  return ICONS.find((i) => i.match.test(name))?.icon ?? DEFAULT_ICON;
}

export default function CategoryIconRow({
  categories,
  routinesCount = 0,
}: {
  categories: Category[];
  /** Pass routines.length from the homepage to surface "الروتين" as a
   * first-class entry alongside real categories — no backend category
   * exists for it, so this stays purely presentational. */
  routinesCount?: number;
}) {
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
        <div className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-around sm:overflow-visible sm:snap-none">
          {routinesCount > 0 && (
            <Link
              href={`/products?category=${ROUTINES_CATEGORY_ID}`}
              className="flex flex-col items-center gap-3 text-center flex-none snap-start"
            >
              <ROUTINES_ICON color="var(--rose)" />
              <div>
                <div className="text-[15px] font-bold">{ROUTINES_CATEGORY_LABEL}</div>
                <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  {routinesCount.toLocaleString('ar-EG')} روتين
                </div>
              </div>
            </Link>
          )}
          {categories.map((c) => {
            const Icon = iconFor(c.name);
            return (
              <Link
                key={c.id}
                href={`/products?category=${c.id}`}
                className="flex flex-col items-center gap-3 text-center flex-none snap-start"
              >
                <Icon color="var(--forest)" />
                <div>
                  <div className="text-[15px] font-bold">{categoryLabel(c.name)}</div>
                  <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
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
