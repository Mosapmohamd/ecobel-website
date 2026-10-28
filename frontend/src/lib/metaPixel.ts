/**
 * Meta Pixel — browser events for ads measurement. NOT a source of truth for
 * revenue (that's the accounting system's ledger, docs/REVENUE.md there).
 *
 * Framework-free on purpose (no React, no "@/" imports): the rules below are
 * unit-tested with `npm test` (node --test). src/lib/analytics.ts wires it to
 * the browser; components call it from event handlers and effects.
 *
 * Rules:
 * - No (valid) Pixel ID → every call is a no-op: nothing loads, nothing sends.
 * - No consent → the same: nothing loads, nothing sends (lib/consent.ts —
 *   opt-in, off until the visitor accepts). Revoking stops every later event
 *   (and tells an already-loaded Meta script to stop: fbq('consent','revoke')).
 * - Only our explicit events: Meta's automatic events are switched off
 *   (autoConfig false, before init) and so is its automatic PageView on
 *   history changes (disablePushState) — the route component sends those.
 * - The Meta base code loads and `init` runs once — not per render, not per
 *   route, not again after hot reload (the init is marked on `fbq` itself).
 * - One PageView per page: the first event on a new path sends it, so a
 *   product view can never be counted against the previous page, and React
 *   Strict Mode's double effects or re-renders can't send a second one.
 * - ViewContent / Search / InitiateCheckout: at most once per page view for
 *   the same product / term / checkout. AddToCart: once per real add.
 * - Purchase: only for an order that is COMPLETED AND PAID — delivered and
 *   cash on delivery (the agreed business rule) — never at checkout or order
 *   creation; other payment methods never, until a real paid state exists.
 *   Once per order: eventID "purchase_<order id>" (Meta dedupes on it, also
 *   against a future server-side event with the same id) + a local record.
 * - Only product ids, quantities, prices, currency and the order id (for
 *   dedupe) are sent — never names, phones, addresses, tokens or passwords.
 */

export const CURRENCY = 'EGP';

/** The global `fbq` function the Meta base code defines. */
export interface Fbq {
  (...args: unknown[]): void;
  /** Pixel ID this page already ran `init` for (set by us). */
  ecobelInitialized?: string;
}

/** Where the tracker meets the browser (a fake one in tests). */
export interface PixelHost {
  /** Installs the Meta base code (fbq stub + fbevents.js) if not there yet. */
  load(): void;
  fbq(): Fbq | undefined;
  /** The current URL path (no query): one PageView per path visited. */
  path(): string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TrackerOptions {
  pixelId: string | null | undefined;
  host: PixelHost;
  /** A consent gate, for when the site gets one. No consent mechanism exists
   * today, so the default is "allowed". */
  consent?: () => boolean;
  /** Remembers which orders' Purchase was sent (localStorage in browsers). */
  storage?: KeyValueStore | null;
}

export interface Item {
  id: string;
  quantity: number;
  /** Unit price charged (EGP). */
  price: number;
}

/** What the storefront knows about a customer's order (lib/api.ts Order). */
export interface OrderLike {
  id: string;
  status: string;
  payment_method: string;
  total_amount: number;
  items: { product_id: string; quantity: number; unit_price: number }[];
}

export const PURCHASE_STORE_KEY = 'ecobel_meta_purchases';
const PURCHASE_MEMORY = 200;

/** Meta Pixel IDs are numeric. Anything else disables tracking. */
export function validPixelId(id: string | null | undefined): string | null {
  const v = (id ?? '').trim();
  return /^\d{6,20}$/.test(v) ? v : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function contentParams(items: Item[], value?: number) {
  const clean = items.filter((i) => i.id && i.quantity > 0);
  return {
    content_type: 'product',
    content_ids: clean.map((i) => i.id),
    contents: clean.map((i) => ({ id: i.id, quantity: i.quantity, item_price: round2(i.price) })),
    num_items: clean.reduce((n, i) => n + i.quantity, 0),
    value: round2(value ?? clean.reduce((s, i) => s + i.price * i.quantity, 0)),
    currency: CURRENCY,
  };
}

/** The Purchase event an order qualifies for — or null. Completed AND paid
 * only: delivered + cash on delivery. The value is the order total as
 * recognized at delivery (products after offers and coupon, plus shipping),
 * the same figure the accounting ledger recognizes. */
export function purchaseEvent(order: OrderLike): { eventID: string; params: ReturnType<typeof contentParams> } | null {
  if (order.status !== 'delivered' || order.payment_method !== 'cash_on_delivery') return null;
  if (!(order.total_amount > 0) || !order.id) return null;
  const items = order.items.map((i) => ({ id: i.product_id, quantity: i.quantity, price: i.unit_price }));
  return { eventID: `purchase_${order.id}`, params: contentParams(items, order.total_amount) };
}

export function createMetaPixel({ pixelId, host, consent = () => true, storage = null }: TrackerOptions) {
  const id = validPixelId(pixelId);
  let lastPath: string | null = null;
  let view = 0; // page-view counter: "once per page" keys include it
  const sentThisView = new Set<string>();

  function fbqReady(): Fbq | null {
    if (!id || !consent()) return null;
    host.load();
    const fbq = host.fbq();
    if (!fbq) return null;
    if (fbq.ecobelInitialized !== id) {
      fbq('set', 'autoConfig', false, id); // no automatic button/metadata events
      fbq('init', id);
      fbq.ecobelInitialized = id;
    }
    return fbq;
  }

  /** Sends PageView when the path changed since the last one. */
  function syncPage(fbq: Fbq): void {
    const path = host.path();
    if (path === lastPath) return;
    lastPath = path;
    view += 1;
    sentThisView.clear();
    fbq('track', 'PageView');
  }

  function track(name: string, params: object, opts: { oncePerView?: string; eventID?: string } = {}): boolean {
    const fbq = fbqReady();
    if (!fbq) return false;
    syncPage(fbq);
    if (opts.oncePerView) {
      const key = `${view}|${opts.oncePerView}`;
      if (sentThisView.has(key)) return false;
      sentThisView.add(key);
    }
    if (opts.eventID) fbq('track', name, params, { eventID: opts.eventID });
    else fbq('track', name, params);
    return true;
  }

  function purchasesSent(): string[] {
    try {
      const raw = storage?.getItem(PURCHASE_STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  const purchasedNow = new Set<string>();

  return {
    enabled: id !== null,

    /** The visitor's choice changed (lib/consent.ts). Granting starts
     * tracking on the current page; revoking stops it — nothing more is sent,
     * and an already-loaded Meta script is told to stop too. */
    consentChanged(granted: boolean): void {
      if (!id) return;
      const loaded = host.fbq();
      if (loaded && loaded.ecobelInitialized === id) loaded('consent', granted ? 'grant' : 'revoke');
      if (granted) {
        // The page the visitor is on now gets its PageView (none was sent
        // without consent); re-granting on an already-counted page adds none.
        const fbq = fbqReady();
        if (fbq) syncPage(fbq);
      }
    },

    /** Call on every route change (and first load). */
    pageView(): boolean {
      const fbq = fbqReady();
      if (!fbq) return false;
      const before = view;
      syncPage(fbq);
      return view !== before;
    },

    viewContent(product: { id: string; price: number }): boolean {
      return track('ViewContent', contentParams([{ id: product.id, quantity: 1, price: product.price }], product.price),
        { oncePerView: `vc:${product.id}` });
    },

    search(term: string): boolean {
      const q = term.trim();
      if (!q) return false;
      return track('Search', { search_string: q.slice(0, 100) }, { oncePerView: `s:${q}` });
    },

    addToCart(items: Item[], value?: number): boolean {
      if (!items.some((i) => i.quantity > 0)) return false;
      return track('AddToCart', contentParams(items, value));
    },

    initiateCheckout(items: Item[], value: number): boolean {
      if (!items.some((i) => i.quantity > 0)) return false;
      return track('InitiateCheckout', contentParams(items, value), { oncePerView: 'checkout' });
    },

    /** Sends Purchase for an order that qualifies, once per order. */
    purchase(order: OrderLike): boolean {
      const ev = purchaseEvent(order);
      if (!ev) return false;
      const sent = purchasesSent();
      if (purchasedNow.has(order.id) || sent.includes(order.id)) return false;
      if (!track('Purchase', ev.params, { eventID: ev.eventID })) return false;
      purchasedNow.add(order.id);
      try {
        storage?.setItem(PURCHASE_STORE_KEY, JSON.stringify([...sent, order.id].slice(-PURCHASE_MEMORY)));
      } catch {
        // storage blocked: the in-memory record and Meta's eventID dedupe remain
      }
      return true;
    },
  };
}

export type MetaPixel = ReturnType<typeof createMetaPixel>;

/** The official Meta Pixel base code (the fbq queue stub that loads
 * fbevents.js), installed once, without its inline init/PageView — the
 * tracker sends those itself. Only touches window/document when called. */
export function browserHost(): PixelHost {
  return {
    load() {
      const w = window as unknown as { fbq?: Fbq & Record<string, unknown>; _fbq?: unknown };
      if (w.fbq) return;
      const queue: unknown[][] = [];
      const stub = function (...args: unknown[]) {
        const s = stub as unknown as { callMethod?: (...a: unknown[]) => void };
        if (s.callMethod) s.callMethod(...args);
        else queue.push(args);
      } as unknown as Fbq & Record<string, unknown>;
      stub.push = stub;
      stub.loaded = true;
      stub.version = '2.0';
      stub.queue = queue;
      // We send PageView on route changes ourselves (components/MetaPixel.tsx);
      // Meta's own history-API PageViews would double-count them.
      stub.disablePushState = true;
      w.fbq = stub;
      if (!w._fbq) w._fbq = stub;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    },
    fbq() {
      return (window as unknown as { fbq?: Fbq }).fbq;
    },
    path() {
      return window.location.pathname;
    },
  };
}
