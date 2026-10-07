import type { HeroSlide } from '@/components/HeroCarousel';
import type { Category } from './api';
import { ROUTINES_PATH } from './constants';

/** Homepage campaign banners — edit here, not in JSX.
 *
 * Each banner is finished art (headline, copy and call to action are part
 * of the image), so the carousel shows it as-is and links the whole banner.
 * To add one: drop a ~1900×630 image in /public/hero/ (optionally a
 * ~1200×900 phone crop as `mobileImage`), describe what it says in `alt`,
 * and point it at a page — `href`, or `category` (the catalog
 * category name) to link to that category. */
export interface HeroSlideConfig extends Omit<HeroSlide, 'href'> {
  href?: string;
  category?: string;
}

export const HERO_SLIDES: HeroSlideConfig[] = [
  {
    id: 'body-moisture',
    image: '/hero/natural-routine.png',
    alt: 'ترطيب الجسم من إيكوبيل — بشرة ناعمة ومشرقة من أول استخدام. لوشن إيكوبيل وكريم اليوريا، ترطيب يدوم طوال اليوم.',
    category: 'العناية بالجسم',
  },
  {
    id: 'routines',
    image: '/hero/routines.png',
    alt: 'إيكوبيل للعناية بالبشرة والشعر — روتين عناية واحد لنتيجة تلاحظيها فعلًا. منتجات مصممة بعناية بتركيبات آمنة وفعالة للاستخدام اليومي.',
    href: ROUTINES_PATH,
  },
];

/** Resolves `category` names to real catalog links; a banner whose category
 * isn't in the catalog links to all products rather than to a dead filter. */
export function buildHeroSlides(config: HeroSlideConfig[], categories: Category[]): HeroSlide[] {
  return config.map(({ category, href, ...slide }) => {
    const match = category ? categories.find((c) => c.name === category) : undefined;
    return { ...slide, href: href ?? (match ? `/products?category=${match.id}` : '/products') };
  });
}
