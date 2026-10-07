'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cartApi, type CartQuote } from './api';
import { createPersistedStore } from './persistedStore';

/** What the browser remembers: which products, how many. Never prices —
 * those always come from the server quote (the same rules checkout uses). */
export interface CartLine {
  productId: string;
  quantity: number;
}

const MAX_LINE_QUANTITY = 100;

function parseLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): CartLine[] => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as { productId?: unknown; product?: { id?: unknown }; quantity?: unknown };
    // Older carts stored a whole product snapshot under `product`.
    const productId = typeof rec.productId === 'string' ? rec.productId : typeof rec.product?.id === 'string' ? rec.product.id : null;
    const quantity = typeof rec.quantity === 'number' ? Math.floor(rec.quantity) : 0;
    return productId && quantity > 0 ? [{ productId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }] : [];
  });
}

const store = createPersistedStore<CartLine[]>('ecobel_cart', [], parseLines);

function addInto(prev: CartLine[], items: CartLine[]): CartLine[] {
  const next = [...prev];
  for (const { productId, quantity } of items) {
    const i = next.findIndex((l) => l.productId === productId);
    if (i >= 0) next[i] = { productId, quantity: Math.min(next[i].quantity + quantity, MAX_LINE_QUANTITY) };
    else next.push({ productId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) });
  }
  return next;
}

interface CartContextValue {
  lines: CartLine[];
  /** Total pieces, for the header badge. */
  count: number;
  add: (productId: string, quantity?: number) => void;
  /** Several products at once (e.g. every product in a routine). */
  addMany: (items: CartLine[]) => void;
  remove: (productId: string) => void;
  /** Put a removed line back at its original position (undo). */
  restore: (line: CartLine, index: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  /** Server-priced view of the current lines; null until the first quote. */
  quote: CartQuote | null;
  /** True while the quote doesn't yet reflect the latest lines. */
  quoting: boolean;
  quoteError: string | null;
  retryQuote: () => void;
  /** Delivery city and applied coupon code — sent with the quote so its
   * discount, shipping and total are exactly what checkout charges. */
  checkout: CheckoutContext;
  setCheckout: (update: Partial<CheckoutContext>) => void;
}

export interface CheckoutContext {
  city: string;
  couponCode: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = store.useValue();
  const [checkout, setCheckoutState] = useState<CheckoutContext>({ city: '', couponCode: '' });
  const key = useMemo(() => JSON.stringify([lines, checkout]), [lines, checkout]);
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    const t = setTimeout(() => {
      cartApi
        .quote(lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })), checkout)
        .then((quote) => !cancelled && setResult({ key, quote, error: null }))
        .catch((err) => !cancelled && setResult({ key, quote: null, error: err instanceof Error ? err.message : 'تعذر تحديث أسعار السلة' }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, lines, checkout, attempt]);

  const empty = lines.length === 0;
  const fresh = result?.key === key;
  const value: CartContextValue = {
    lines,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    add: (productId, quantity = 1) => store.set((prev) => addInto(prev, [{ productId, quantity }])),
    addMany: (items) => store.set((prev) => addInto(prev, items)),
    remove: (productId) => store.set((prev) => prev.filter((l) => l.productId !== productId)),
    restore: (line, index) =>
      store.set((prev) => {
        if (prev.some((l) => l.productId === line.productId)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, line);
        return next;
      }),
    setQuantity: (productId, quantity) =>
      store.set((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.productId !== productId)
          : prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, MAX_LINE_QUANTITY) } : l)),
      ),
    clear: () => store.set(() => []),
    // Keep showing the last quote while a new one loads (no flicker).
    quote: empty ? null : (result?.quote ?? null),
    quoting: !empty && !fresh,
    quoteError: !empty && fresh ? (result?.error ?? null) : null,
    retryQuote: () => setAttempt((n) => n + 1),
    checkout,
    setCheckout: (update) => setCheckoutState((prev) => ({ ...prev, ...update })),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
