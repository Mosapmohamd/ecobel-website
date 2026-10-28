'use client';

import { browserHost, createMetaPixel, type KeyValueStore } from './metaPixel';

/** localStorage when the browser allows it (private modes may not). */
function safeStorage(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The site's one Meta Pixel tracker. Disabled (every call a no-op) unless
 * NEXT_PUBLIC_META_PIXEL_ID is set to a numeric Pixel ID at build time —
 * and on the server, where there's no window. See lib/metaPixel.ts. */
export const pixel = createMetaPixel({
  pixelId: typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_META_PIXEL_ID : null,
  host: browserHost(),
  storage: safeStorage(),
});
