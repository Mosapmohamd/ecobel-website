'use client';

import { useSyncExternalStore } from 'react';
import { createConsentStore, CONSENT_KEY, type ConsentChoice } from './consent';
import { browserHost, createMetaPixel, type KeyValueStore } from './metaPixel';

/** localStorage when the browser allows it (private modes may not). */
function safeStorage(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The visitor's privacy choice (opt-in; lib/consent.ts). */
export const consent = createConsentStore(safeStorage());

/** The site's one Meta Pixel tracker. Disabled (every call a no-op) unless
 * NEXT_PUBLIC_META_PIXEL_ID is set to a numeric Pixel ID at build time — and
 * on the server, where there's no window — and silent until the visitor
 * accepts tracking. See lib/metaPixel.ts. */
export const pixel = createMetaPixel({
  pixelId: typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_META_PIXEL_ID : null,
  host: browserHost(),
  storage: safeStorage(),
  consent: () => consent.marketingAllowed(),
});

consent.subscribe((choice) => pixel.consentChanged(choice?.marketing === true));
if (typeof window !== 'undefined') {
  // A choice made in another tab applies here too.
  window.addEventListener('storage', (e) => {
    if (e.key === CONSENT_KEY) consent.refresh();
  });
}

/** The current choice for components: undefined while rendering on the
 * server / before hydration (render nothing then), null = not decided. */
export function useConsent(): ConsentChoice | null | undefined {
  return useSyncExternalStore(
    (cb) => consent.subscribe(cb),
    () => consent.get(),
    () => undefined,
  );
}

/** Opens the privacy preferences (footer link → components/ConsentBanner.tsx). */
export const OPEN_PRIVACY_PREFERENCES = 'ecobel:privacy-preferences';
