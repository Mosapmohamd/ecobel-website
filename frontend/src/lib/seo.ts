/** Canonical site URL, for canonical links, Open Graph, structured data and
 * the sitemap. Set NEXT_PUBLIC_SITE_URL to the public https origin in
 * production (the build refuses to run without it — see next.config.ts). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = 'Eco Bel';
export const DEFAULT_DESCRIPTION = 'منتجات طبيعية للعناية بالبشرة والشعر — شحن لكل المحافظات، دفع عند الاستلام.';

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** A meta description from real text: whitespace collapsed, cut at a word. */
export function describe(text: string | null | undefined, fallback: string, max = 155): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return fallback;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** Robots value for pages that should never be indexed (personal/transactional). */
export const NO_INDEX = { index: false, follow: true } as const;
