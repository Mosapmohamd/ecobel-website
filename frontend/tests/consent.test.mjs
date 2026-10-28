// Opt-in consent (src/lib/consent.ts) and its effect on the Meta Pixel
// (src/lib/metaPixel.ts), against fakes — nothing is ever sent to Meta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsentStore, CONSENT_KEY, CONSENT_VERSION } from '../src/lib/consent.ts';
import { createMetaPixel } from '../src/lib/metaPixel.ts';

const ID = '123456789012345';

function memoryStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

function fakeHost(path = '/') {
  const calls = [];
  let loads = 0;
  let fbq;
  const host = {
    current: path,
    path: () => host.current,
    load() { loads += 1; if (!fbq) fbq = (...a) => calls.push(a); },
    fbq: () => fbq,
  };
  return { host, calls, loads: () => loads, tracked: () => calls.filter((c) => c[0] === 'track').map((c) => c[1]) };
}

/** The app's wiring (lib/analytics.ts): pixel gated on the store, told of changes. */
function wired(storage = memoryStore(), path = '/') {
  const consent = createConsentStore(storage, () => new Date('2026-10-28T10:00:00Z'));
  const f = fakeHost(path);
  const pixel = createMetaPixel({ pixelId: ID, host: f.host, consent: () => consent.marketingAllowed(), storage: memoryStore() });
  consent.subscribe((c) => pixel.consentChanged(c?.marketing === true));
  return { consent, pixel, f, storage };
}

const order = { id: 'o1', status: 'delivered', payment_method: 'cash_on_delivery', total_amount: 300, items: [{ product_id: 'p', quantity: 1, unit_price: 260 }] };

test('no choice yet = no consent: nothing loads, nothing is sent, on any route or event', () => {
  const { consent, pixel, f } = wired();
  assert.equal(consent.get(), null);
  assert.equal(consent.marketingAllowed(), false);
  pixel.pageView();
  f.host.current = '/products/p';
  pixel.pageView();
  pixel.viewContent({ id: 'p', price: 10 });
  pixel.search('x');
  pixel.addToCart([{ id: 'p', quantity: 1, price: 10 }]);
  pixel.initiateCheckout([{ id: 'p', quantity: 1, price: 10 }], 10);
  pixel.purchase(order);
  assert.equal(f.loads(), 0);
  assert.deepEqual(f.calls, []);
});

test('reject: still nothing loads or is sent, and the choice is remembered', () => {
  const { consent, pixel, f, storage } = wired();
  consent.set(false);
  pixel.pageView();
  pixel.addToCart([{ id: 'p', quantity: 1, price: 10 }]);
  assert.equal(f.loads(), 0);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(JSON.parse(storage.getItem(CONSENT_KEY)), { marketing: false, decidedAt: '2026-10-28T10:00:00.000Z', version: CONSENT_VERSION });
  const later = wired(storage); // next visit
  assert.equal(later.consent.marketingAllowed(), false);
  later.pixel.pageView();
  assert.deepEqual(later.f.calls, []);
});

test('accept: tracking starts on the current page (one PageView), then follows routes', () => {
  const { consent, pixel, f } = wired(memoryStore(), '/products');
  pixel.pageView(); // before the choice: nothing
  consent.set(true);
  assert.deepEqual(f.tracked(), ['PageView']);
  pixel.pageView(); // the route component re-running: no duplicate
  f.host.current = '/cart';
  pixel.pageView();
  assert.deepEqual(f.tracked(), ['PageView', 'PageView']);
  assert.deepEqual(f.calls.slice(0, 2), [['set', 'autoConfig', false, ID], ['init', ID]]);
});

test('changing to reject stops every later event and tells Meta\'s script to stop', () => {
  const { consent, pixel, f } = wired();
  consent.set(true);
  pixel.addToCart([{ id: 'p', quantity: 1, price: 10 }]);
  const before = f.tracked().length;
  consent.set(false);
  assert.deepEqual(f.calls.at(-1), ['consent', 'revoke']);
  f.host.current = '/products';
  pixel.pageView();
  pixel.viewContent({ id: 'p', price: 10 });
  pixel.addToCart([{ id: 'p', quantity: 1, price: 10 }]);
  pixel.purchase(order);
  assert.equal(f.tracked().length, before);
  // and accepting again resumes, telling the script too
  consent.set(true);
  assert.ok(f.calls.some((c) => c[0] === 'consent' && c[1] === 'grant'));
  assert.equal(f.tracked().at(-1), 'PageView'); // the page the visitor is on now
});

test('Purchase waits for consent and is sent once after it is given', () => {
  const { consent, pixel, f } = wired(memoryStore(), '/account');
  assert.equal(pixel.purchase(order), false);
  consent.set(true);
  assert.equal(pixel.purchase(order), true);
  assert.equal(pixel.purchase(order), false);
  assert.equal(f.tracked().filter((t) => t === 'Purchase').length, 1);
});

test('unreadable, tampered or outdated records count as "no choice" (asked again, tracking off)', () => {
  for (const raw of ['{bad json', '"yes"', 'null', JSON.stringify({ marketing: 'true', version: CONSENT_VERSION }),
    JSON.stringify({ marketing: true, version: CONSENT_VERSION - 1 }), JSON.stringify({ marketing: true })]) {
    const c = createConsentStore(memoryStore({ [CONSENT_KEY]: raw }));
    assert.equal(c.get(), null, raw);
    assert.equal(c.marketingAllowed(), false, raw);
  }
});

test('blocked storage: the choice holds for the visit, never defaults to yes', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const c = createConsentStore(blocked);
  assert.equal(c.marketingAllowed(), false);
  c.set(true);
  assert.equal(c.marketingAllowed(), true);
  assert.equal(createConsentStore(blocked).marketingAllowed(), false); // next visit: asked again
});

test('a choice made in another tab applies after refresh()', () => {
  const shared = memoryStore();
  const a = wired(shared);
  const b = wired(shared);
  a.consent.set(true);
  b.consent.refresh();
  assert.equal(b.consent.marketingAllowed(), true);
  assert.deepEqual(b.f.tracked(), ['PageView']);
  a.consent.set(false);
  b.consent.refresh();
  assert.deepEqual(b.f.calls.at(-1), ['consent', 'revoke']);
});

test('without a Pixel ID, consent changes do nothing', () => {
  const consent = createConsentStore(memoryStore());
  const f = fakeHost();
  const pixel = createMetaPixel({ pixelId: '', host: f.host, consent: () => consent.marketingAllowed() });
  consent.subscribe((c) => pixel.consentChanged(c?.marketing === true));
  consent.set(true);
  pixel.pageView();
  assert.equal(f.loads(), 0);
  assert.deepEqual(f.calls, []);
});
