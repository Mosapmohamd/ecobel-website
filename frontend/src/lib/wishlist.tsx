'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createPersistedStore } from './persistedStore';

/** The wishlist remembers product ids only; the wishlist page loads each
 * product fresh, so prices and availability are never stale. */
function parseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.flatMap((item) => {
    if (typeof item === 'string') return [item];
    // Older wishlists stored whole product snapshots.
    if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') return [(item as { id: string }).id];
    return [];
  });
  return Array.from(new Set(ids));
}

const store = createPersistedStore<string[]>('ecobel_wishlist', [], parseIds);

interface WishlistContextValue {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const ids = store.useValue();
  const value: WishlistContextValue = {
    ids,
    has: (productId) => ids.includes(productId),
    toggle: (productId) =>
      store.set((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId])),
    remove: (productId) => store.set((prev) => prev.filter((id) => id !== productId)),
    count: ids.length,
  };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
