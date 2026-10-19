import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import JsonLd from '@/components/JsonLd';
import { getProduct, getRelated, getReviews, NOT_FOUND } from '@/lib/server-api';
import { SITE_NAME, absoluteUrl, describe } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (product === NOT_FOUND) return { title: 'المنتج غير موجود', robots: { index: false } };
  if (!product) return {}; // API unreachable: keep the site defaults rather than guess
  const path = `/products/${encodeURIComponent(product.id)}`;
  const description = describe(product.description, `${product.name} من ${product.category_name} — منتجات Eco Bel الطبيعية.`);
  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: product.name,
      description,
      url: path,
      ...(product.image_url ? { images: [{ url: product.image_url, alt: product.name }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, related, reviews] = await Promise.all([getProduct(id), getRelated(id), getReviews(id)]);
  // Unknown or deactivated product → a real 404 (not a "not found" text on a 200 page).
  if (product === NOT_FOUND) notFound();

  return (
    <>
      {product && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Product',
                name: product.name,
                ...(product.description ? { description: product.description } : {}),
                ...(product.sku ? { sku: product.sku } : {}),
                ...(product.image_url ? { image: [product.image_url] } : {}),
                category: product.category_name,
                brand: { '@type': 'Brand', name: SITE_NAME },
                url: absoluteUrl(`/products/${encodeURIComponent(product.id)}`),
                // The price checkout charges (offers applied by the API) and
                // whether it can be ordered right now — never estimated here.
                offers: {
                  '@type': 'Offer',
                  price: product.price,
                  priceCurrency: 'EGP',
                  availability: product.max_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                  url: absoluteUrl(`/products/${encodeURIComponent(product.id)}`),
                  seller: { '@id': absoluteUrl('/#organization') },
                },
                // Only real, published reviews.
                ...(reviews && reviews.review_count > 0
                  ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average_rating, reviewCount: reviews.review_count, bestRating: 5, worstRating: 1 } }
                  : {}),
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: absoluteUrl('/') },
                  { '@type': 'ListItem', position: 2, name: product.category_name, item: absoluteUrl(`/products?category=${encodeURIComponent(product.category_id)}`) },
                  { '@type': 'ListItem', position: 3, name: product.name },
                ],
              },
            ],
          }}
        />
      )}
      <ProductDetailClient key={id} id={id} initialProduct={product} initialRelated={related} initialReviews={reviews} />
    </>
  );
}
