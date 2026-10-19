import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RoutineDetailClient from './RoutineDetailClient';
import JsonLd from '@/components/JsonLd';
import { getRoutine, getRoutines, NOT_FOUND } from '@/lib/server-api';
import { ROUTINES_LABEL, ROUTINES_PATH } from '@/lib/constants';
import { absoluteUrl, describe } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const routine = await getRoutine(id);
  if (routine === NOT_FOUND) return { title: 'الروتين غير موجود', robots: { index: false } };
  if (!routine) return {};
  const path = `${ROUTINES_PATH}/${encodeURIComponent(routine.id)}`;
  const steps = routine.items.map((it) => it.product.name).join('، ');
  const description = describe(routine.description, `${routine.name}: ${steps}.`);
  const image = routine.items.find((it) => it.product.image_url)?.product.image_url;
  return {
    title: routine.name,
    description,
    alternates: { canonical: path },
    openGraph: { title: routine.name, description, url: path, ...(image ? { images: [{ url: image, alt: routine.name }] } : {}) },
  };
}

export default async function RoutinePage({ params }: Props) {
  const { id } = await params;
  const [routine, routines] = await Promise.all([getRoutine(id), getRoutines()]);
  if (routine === NOT_FOUND) notFound();
  const path = `${ROUTINES_PATH}/${encodeURIComponent(id)}`;

  return (
    <>
      {routine && (
        // A routine is a set of separately sold products, not one item with
        // its own price — so a breadcrumb and the list of its products, not
        // a Product offer.
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'ItemList',
                name: routine.name,
                url: absoluteUrl(path),
                numberOfItems: routine.items.length,
                itemListElement: routine.items.map((it, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: it.product.name,
                  url: absoluteUrl(`/products/${encodeURIComponent(it.product.id)}`),
                })),
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: absoluteUrl('/') },
                  { '@type': 'ListItem', position: 2, name: ROUTINES_LABEL, item: absoluteUrl(ROUTINES_PATH) },
                  { '@type': 'ListItem', position: 3, name: routine.name },
                ],
              },
            ],
          }}
        />
      )}
      <RoutineDetailClient key={id} id={id} initialRoutine={routine} initialRoutines={routines} />
    </>
  );
}
