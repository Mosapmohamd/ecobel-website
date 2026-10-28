# Meta Pixel (new storefront)

Browser events for Meta ads measurement on the Next.js storefront. **Not** a
source of truth for revenue — that's the accounting ledger
(`ecobel-accounting-system/docs/REVENUE.md`). Nothing here touches the live
WordPress site.

## Turning it on

Set one public build-time variable on the storefront's hosting (e.g. the
Vercel project's environment variables, Production), then rebuild:

```
NEXT_PUBLIC_META_PIXEL_ID=<numeric Pixel ID from Meta Events Manager>
```

Unset, empty or not numeric → tracking is off: no script loads, nothing is
sent, and the Content-Security-Policy keeps Meta's hosts out. When set, the
CSP (`next.config.ts`) adds exactly: `script-src https://connect.facebook.net`
(Meta's script), `img-src https://www.facebook.com` and `connect-src
https://www.facebook.com` (its beacons) — no wildcards, nothing else.

`.env.local.example` documents the variable (empty). Real `.env*` files are
gitignored. Never put a placeholder ID in a runtime env file: an invalid value
just keeps tracking off, a wrong numeric one would send events to someone
else's Pixel.

The accounting system's **Settings → Integrations** page can check the
deployed storefront (Pixel ID served, CSP) — see
`ecobel-accounting-system/docs/INTEGRATIONS.md`.

## Code

| File | Role |
|---|---|
| `frontend/src/lib/metaPixel.ts` | the rules (framework-free, unit-tested) + Meta's base code |
| `frontend/src/lib/analytics.ts` | the site's one tracker |
| `frontend/src/components/MetaPixel.tsx` | PageView on load and route changes (root layout) |
| `frontend/tests/metaPixel.test.mjs` | `npm test` — fakes only, never sends to Meta |

## Events

| Event | When | Parameters |
|---|---|---|
| `PageView` | first load and each new path (client navigation included) | — |
| `ViewContent` | product page shown | `content_ids`, `contents`, `value`, `currency` |
| `Search` | search results page for a term | `search_string` |
| `AddToCart` | a real add (product card / page, routine, bundle) | ids, quantities, item prices, value (routine/bundle price when bought as one) |
| `InitiateCheckout` | the customer starts filling in the checkout form | ids, quantities, prices, value = the server quote's total |
| `Purchase` | a **delivered, cash-on-delivery** order (completed AND paid) | ids, quantities, prices, value = order total (shipping included), `eventID` |

Currency: `EGP`. Only product ids, quantities, prices and the order id (as
the Purchase `eventID`) are sent — never names, phones, addresses, tokens or
passwords.

## No duplicates

- The base code loads and `init` runs once per page load (also across hot
  reloads — the init is marked on `fbq`).
- One PageView per path visited; Strict Mode's double effects, re-renders and
  query-string changes (filters, sorting) don't add more. The first event on
  a new page sends that page's PageView before it.
- ViewContent / Search / InitiateCheckout: once per page view for the same
  product / term / checkout.
- Purchase: once per order — `eventID: "purchase_<order id>"` (Meta
  deduplicates on it) plus a local record in `localStorage`
  (`ecobel_meta_purchases`).

## Purchase — the gap, and the reliable fix

The browser can only see that an order is delivered when the server says so.
Today that's the customer's **account page** (signed-in customers): when it
lists a delivered COD order, Purchase is sent (once). Not covered:

- **guest orders** — the guest tracking page shows a masked status only, by
  design (no order id or amount), so it never sends Purchase;
- customers who don't come back to their account after delivery;
- the delay between delivery and that visit;
- **returns** after delivery — Meta has no "negative purchase"; the value
  sent stays the delivered total.

Purchase is **never** sent at checkout or order creation, nor for pending,
shipped, cancelled or non-cash-on-delivery orders.

The browser path is a best-effort supplement — it must not be the only
Purchase source in production. The accounting system already knows, server-
side, exactly which orders qualify (delivered + cash on delivery, with the
delivery time from its status audit); its Integrations page shows them.

**Reliable path (not built — needs credentials and a scope decision):** send
Purchase **server-side** with the Meta Conversions API from the accounting
backend at the moment staff mark a COD order delivered
(`PATCH /online-orders/{id}/status` → delivered, after the revenue entry is
written), with the same `event_id = "purchase_<order id>"`, so Meta
deduplicates it against the browser event. It needs a Conversions API access
token (server secret, never `NEXT_PUBLIC_*`), hashed customer data rules
(phone → SHA-256, per Meta's spec) and a retry/outbox so a Meta outage can't
block or duplicate the status change.

## Consent

The storefront has no consent banner or consent setting today, so tracking is
on whenever the Pixel ID is set. `createMetaPixel` takes a `consent()` gate:
when a consent mechanism is added, wire it there and nothing is loaded or sent
until it allows.

**Decision needed before setting the production Pixel ID:** whether visitors
must consent first (Egypt's Personal Data Protection Law no. 151/2020, and EU
rules for any EU visitors — legal advice, not an engineering call), and the
privacy-policy wording that discloses Meta tracking. Data sent: page URLs,
product ids/prices, search terms typed (capped at 100 characters — a visitor
could type anything), cart and order values, and the order id for Purchase.
Meta also sets its own cookies (`_fbp`) and sees the visitor's IP and browser.

## Verifying (before relying on it)

Unit tests: `cd frontend && npm test`. With a real Pixel ID, check events in
Meta Events Manager → Test Events / Pixel Helper on a preview deployment —
this repository has **not** verified that any event reaches Meta.
