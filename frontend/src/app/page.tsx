import type { Metadata } from 'next';
import HomeClient, { type HomeData } from './HomeClient';
import { getCategories, getFeaturedProducts, getFeaturedRoutines, getProductPage, getRoutines } from '@/lib/server-api';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';
import { HOME_OFFERS_SHOWN } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description: DEFAULT_DESCRIPTION,
  openGraph: { url: '/' },
};

export default async function HomePage() {
  // Same requests the page used to make in the browser — now on the server,
  // in parallel, so the HTML arrives with real content (no layout shift).
  const [categories, featured, featuredRoutines, offers, routines] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
    getFeaturedRoutines(),
    getProductPage(`?on_offer=true&limit=${HOME_OFFERS_SHOWN}`),
    getRoutines(),
  ]);
  const initialData: HomeData | null =
    categories && featured && featuredRoutines && offers && routines
      ? { categories, featured, featuredRoutines, offers: offers.items, routineCount: routines.length }
      : null;
  return <HomeClient initialData={initialData} />;
}
