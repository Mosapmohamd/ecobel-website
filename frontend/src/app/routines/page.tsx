import type { Metadata } from 'next';
import RoutinesClient from './RoutinesClient';
import { getRoutines } from '@/lib/server-api';
import { ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';

const DESCRIPTION = 'روتينات عناية متكاملة من منتجات Eco Bel — افتحي أي روتين عشان تشوفي منتجاته وسعره، أو أضيفيه كامل للسلة.';

export const metadata: Metadata = {
  title: ROUTINES_LABEL,
  description: DESCRIPTION,
  alternates: { canonical: ROUTINES_PATH },
  openGraph: { title: ROUTINES_LABEL, description: DESCRIPTION, url: ROUTINES_PATH },
};

export default async function RoutinesPage() {
  return <RoutinesClient initialRoutines={await getRoutines()} />;
}
