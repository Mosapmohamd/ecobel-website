import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal and transactional pages: nothing to find there.
      disallow: ['/cart', '/checkout', '/account', '/wishlist', '/track'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
