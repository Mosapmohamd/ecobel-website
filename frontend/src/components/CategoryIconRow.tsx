import type { ReactElement } from 'react';
import Link from 'next/link';
import type { Category } from '@/lib/api';
import { ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';
import SectionHeader from './SectionHeader';

type IconFn = (p: { color: string }) => ReactElement;

// Icon per category, matched on the catalog's (Arabic) category name;
// the English terms keep older category names matching too.
const ICONS: { match: RegExp; icon: IconFn }[] = [
  {
    match: /skin|بشرة/i,
    icon: ({ color }) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
      </svg>
    ),
  },
  {
    match: /hair|شعر/i,
    icon: ({ color }) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 2C9 6 7 9 7 13a5 5 0 0 0 10 0c0-4-2-7-5-11Z" />
        <path d="M9.5 13a2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
  },
  {
    match: /^men|men's|رجال/i,
    icon: ({ color }) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="8" r="4" />
        <path d="M8 10.5c-.6 1-1 2.3-1 3.5 0 2.5 2.2 4.5 5 4.5s5-2 5-4.5c0-1.2-.4-2.5-1-3.5" />
      </svg>
    ),
  },
  {
    match: /bath|shower|استحمام/i,
    icon: ({ color }) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
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
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
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
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
];

const ROUTINES_ICON: IconFn = ({ color }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
    <rect x="3.5" y="3.5" width="11" height="11" rx="2" />
    <rect x="9.5" y="9.5" width="11" height="11" rx="2" />
  </svg>
);

// A plain tag glyph — used only for a category outside the known set
// above, never shown as every category's icon (that read as a stuck
// loading spinner before the English-name matching was fixed).
const DEFAULT_ICON: IconFn = ({ color }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
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
  tone = 'tint',
}: {
  categories: Category[];
  /** Pass routines.length to surface "الروتين" as a first-class entry
   * alongside the real categories. */
  routinesCount?: number;
  tone?: 'surface' | 'tint';
}) {
  if (categories.length === 0) return null;

  const tiles = [
    ...categories.map((c) => ({
      key: c.id,
      href: `/products?category=${c.id}`,
      label: c.name,
      meta: `${c.product_count.toLocaleString('ar-EG')} منتج`,
      Icon: iconFor(c.name),
    })),
    ...(routinesCount > 0
      ? [{
          key: 'routines',
          href: ROUTINES_PATH,
          label: ROUTINES_LABEL,
          meta: `${routinesCount.toLocaleString('ar-EG')} روتين`,
          Icon: ROUTINES_ICON,
        }]
      : []),
  ];

  return (
    <section aria-labelledby="home-categories" className={`section ${tone === 'tint' ? 'bg-surface-tint' : 'bg-surface'}`}>
      <div className="page-container">
        <SectionHeader
          id="home-categories"
          kicker="فئات مختارة بعناية"
          title="تسوّقي حسب الفئة"
          link={{ href: '/products', label: 'كل المنتجات' }}
        />
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
          {tiles.map(({ key, href, label, meta, Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="card card-hover group h-full flex flex-col items-center text-center gap-3 px-3 py-5"
              >
                <span className="w-16 h-16 rounded-full flex items-center justify-center bg-surface-tint transition-transform group-hover:scale-105">
                  <Icon color="var(--color-primary)" />
                </span>
                <span>
                  <span className="block text-label-lg font-bold leading-snug transition-colors group-hover:text-primary">{label}</span>
                  <span className="block text-label-sm mt-1 text-ink-muted">{meta}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
