// Meta Pixel rules (src/lib/metaPixel.ts) against a fake browser — nothing
// is ever sent to Meta. Run: npm test  (node --test; Node strips the types).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMetaPixel, purchaseEvent, validPixelId, PURCHASE_STORE_KEY } from '../src/lib/metaPixel.ts';

const ID = '123456789012345';

function fakeHost(path = '/') {
  const calls = [];
  let loads = 0;
  let fbq;
  const host = {
    path: () => host.current,
    current: path,
    load() {
      loads += 1;
      if (!fbq) fbq = (...args) => calls.push(args);
    },
    fbq: () => fbq,
  };
  return { host, calls, loads: () => loads, tracked: () => calls.filter((c) => c[0] === 'track').map((c) => c[1]) };
}

function memoryStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

const order = (over = {}) => ({
  id: 'ord_1', status: 'delivered', payment_method: 'cash_on_delivery', total_amount: 571,
  items: [{ product_id: 'p1', quantity: 2, unit_price: 100 }, { product_id: 'p2', quantity: 1, unit_price: 300 }],
  ...over,
});

test('no or invalid Pixel ID: tracking is off and nothing loads', () => {
  for (const pixelId of [undefined, null, '', '   ', 'abc', '12-34', '<script>']) {
    const f = fakeHost();
    const px = createMetaPixel({ pixelId, host: f.host });
    assert.equal(px.enabled, false);
    assert.equal(px.pageView(), false);
    assert.equal(px.viewContent({ id: 'p1', price: 10 }), false);
    assert.equal(px.addToCart([{ id: 'p1', quantity: 1, price: 10 }]), false);
    assert.equal(px.purchase(order()), false);
    assert.equal(f.loads(), 0);
    assert.deepEqual(f.calls, []);
  }
  assert.equal(validPixelId(` ${ID} `), ID);
});

test('init happens once, even across many events and a second tracker (hot reload)', () => {
  const f = fakeHost('/');
  const px = createMetaPixel({ pixelId: ID, host: f.host });
  px.pageView();
  px.viewContent({ id: 'p1', price: 10 });
  px.search('serum');
  const again = createMetaPixel({ pixelId: ID, host: f.host }); // module re-evaluated
  f.host.current = '/products';
  again.pageView();
  assert.equal(f.calls.filter((c) => c[0] === 'init').length, 1);
  // Meta's automatic events are switched off before init
  assert.deepEqual(f.calls.slice(0, 2), [['set', 'autoConfig', false, ID], ['init', ID]]);
});

test('one PageView per page: re-renders / Strict Mode / same route add nothing', () => {
  const f = fakeHost('/');
  const px = createMetaPixel({ pixelId: ID, host: f.host });
  px.pageView();
  px.pageView(); // Strict Mode runs effects twice
  px.pageView();
  f.host.current = '/products';
  px.pageView();
  px.pageView();
  f.host.current = '/';
  px.pageView(); // coming back is a new page view
  assert.deepEqual(f.tracked(), ['PageView', 'PageView', 'PageView']);
});

test('an event on a new page sends that page\'s PageView first (effect order can\'t misattribute it)', () => {
  const f = fakeHost('/');
  const px = createMetaPixel({ pixelId: ID, host: f.host });
  px.pageView();
  f.host.current = '/products/p9';
  px.viewContent({ id: 'p9', price: 250 }); // product page effect ran before the layout's
  px.pageView(); // ...the layout's PageView effect then adds nothing
  assert.deepEqual(f.tracked(), ['PageView', 'PageView', 'ViewContent']);
});

test('ViewContent, Search, AddToCart and InitiateCheckout carry product ids, prices and EGP', () => {
  const f = fakeHost('/products/p1');
  const px = createMetaPixel({ pixelId: ID, host: f.host });
  px.viewContent({ id: 'p1', price: 249.999 });
  px.viewContent({ id: 'p1', price: 249.999 }); // same page: once
  px.search('  فيتامين سي  ');
  px.search('فيتامين سي');
  px.search('   ');
  px.addToCart([{ id: 'p1', quantity: 2, price: 100 }]);
  px.addToCart([{ id: 'p1', quantity: 2, price: 100 }]); // a second real click is a second add
  px.addToCart([{ id: 'p1', quantity: 1, price: 100 }, { id: 'p2', quantity: 1, price: 150 }], 199); // bundle price
  px.initiateCheckout([{ id: 'p1', quantity: 2, price: 100 }], 240);
  px.initiateCheckout([{ id: 'p1', quantity: 2, price: 100 }], 240); // refocusing the form: once
  const events = f.calls.filter((c) => c[0] === 'track');
  assert.deepEqual(events.map((c) => c[1]),
    ['PageView', 'ViewContent', 'Search', 'AddToCart', 'AddToCart', 'AddToCart', 'InitiateCheckout']);
  assert.deepEqual(events[1][2], {
    content_type: 'product', content_ids: ['p1'], contents: [{ id: 'p1', quantity: 1, item_price: 250 }],
    num_items: 1, value: 250, currency: 'EGP',
  });
  assert.deepEqual(events[2][2], { search_string: 'فيتامين سي' });
  assert.equal(events[3][2].value, 200);
  assert.deepEqual(events[5][2].content_ids, ['p1', 'p2']);
  assert.equal(events[5][2].value, 199);
  assert.equal(events[6][2].value, 240);
  assert.equal(events[6][2].num_items, 2);
  for (const [, , params] of events.slice(1)) {
    for (const key of Object.keys(params)) assert.ok(!/name|phone|address|email|token|password/i.test(key), key);
  }
});

test('Purchase only for a delivered cash-on-delivery order — never pending, shipped, cancelled or unpaid', () => {
  assert.equal(purchaseEvent(order({ status: 'pending' })), null); // order just created / checkout
  assert.equal(purchaseEvent(order({ status: 'shipped' })), null);
  assert.equal(purchaseEvent(order({ status: 'cancelled' })), null);
  assert.equal(purchaseEvent(order({ payment_method: 'card' })), null); // no paid state for it yet
  assert.equal(purchaseEvent(order({ total_amount: 0 })), null);
  const ev = purchaseEvent(order());
  assert.equal(ev.eventID, 'purchase_ord_1');
  assert.equal(ev.params.value, 571); // the recognized order total (shipping included)
  assert.equal(ev.params.currency, 'EGP');
  assert.deepEqual(ev.params.content_ids, ['p1', 'p2']);

  const f = fakeHost('/account');
  const px = createMetaPixel({ pixelId: ID, host: f.host, storage: memoryStore() });
  for (const s of ['pending', 'shipped', 'cancelled']) assert.equal(px.purchase(order({ status: s })), false);
  assert.equal(px.purchase(order({ payment_method: 'card' })), false);
  assert.deepEqual(f.tracked().filter((n) => n === 'Purchase'), []);
});

test('a delivered order sends Purchase once, with its eventID, across repeats, reloads and trackers', () => {
  const store = memoryStore();
  const f = fakeHost('/account');
  const px = createMetaPixel({ pixelId: ID, host: f.host, storage: store });
  assert.equal(px.purchase(order()), true);
  assert.equal(px.purchase(order()), false); // the orders list re-rendered
  const purchase = f.calls.find((c) => c[1] === 'Purchase');
  assert.deepEqual(purchase[3], { eventID: 'purchase_ord_1' });
  assert.deepEqual(JSON.parse(store.getItem(PURCHASE_STORE_KEY)), ['ord_1']);
  const later = createMetaPixel({ pixelId: ID, host: f.host, storage: store }); // next visit
  assert.equal(later.purchase(order()), false);
  assert.equal(later.purchase(order({ id: 'ord_2' })), true);
  assert.equal(f.tracked().filter((n) => n === 'Purchase').length, 2);
});

test('blocked or corrupt storage still never double-sends within a visit', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const f = fakeHost('/account');
  const px = createMetaPixel({ pixelId: ID, host: f.host, storage: broken });
  assert.equal(px.purchase(order()), true);
  assert.equal(px.purchase(order()), false);
  const corrupt = memoryStore();
  corrupt.setItem(PURCHASE_STORE_KEY, '{not json');
  assert.equal(createMetaPixel({ pixelId: ID, host: fakeHost().host, storage: corrupt }).purchase(order()), true);
});

test('the consent gate stops everything while it says no', () => {
  let granted = false;
  const f = fakeHost('/');
  const px = createMetaPixel({ pixelId: ID, host: f.host, consent: () => granted, storage: memoryStore() });
  assert.equal(px.pageView(), false);
  assert.equal(px.purchase(order()), false);
  assert.equal(f.loads(), 0);
  granted = true;
  assert.equal(px.pageView(), true);
  assert.equal(px.purchase(order()), true); // not recorded as sent while it was blocked
});
