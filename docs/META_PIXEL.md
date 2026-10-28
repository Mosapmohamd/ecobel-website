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

Unset, empty or not numeric → tracking is off (and no consent banner is
shown — there's nothing optional to choose): no script loads, nothing is
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
| `frontend/src/lib/consent.ts` | the opt-in consent record (framework-free, unit-tested) |
| `frontend/src/lib/analytics.ts` | the site's one tracker, gated on consent |
| `frontend/src/components/MetaPixel.tsx` | PageView on load and route changes (root layout) |
| `frontend/src/components/ConsentBanner.tsx` | accept / reject / preferences (root layout, only with a Pixel ID) |
| `frontend/src/app/privacy/page.tsx` | privacy text — DRAFT, pending legal review, `noindex` |
| `frontend/tests/*.test.mjs` | `npm test` — fakes only, never sends to Meta |

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
- **returns** after delivery are **not subtracted** from Meta's reporting —
  Meta has no "negative purchase"; the value sent stays the delivered total.
  Revenue truth (net of returns) is the accounting system's reports;
- visitors who didn't accept tracking (by design: nothing is sent).

Purchase is **never** sent at checkout or order creation, nor for pending,
shipped, cancelled or non-cash-on-delivery orders.

The browser path is a best-effort supplement — it must not be the only
Purchase source in production. The accounting system already knows, server-
side, exactly which orders qualify (delivered + cash on delivery, with the
delivery time from its status audit); its Integrations page shows them.

**Reliable path — designed, NOT built (decided 2026-10-28: no Conversions
API, no access token requested, stored or exposed in this phase):** send
Purchase **server-side** with the Meta Conversions API from the accounting
backend at the moment staff mark a COD order delivered
(`PATCH /online-orders/{id}/status` → delivered, after the revenue entry is
written), with the same `event_id = "purchase_<order id>"`, so Meta
deduplicates it against the browser event. It needs a Conversions API access
token (server secret, never `NEXT_PUBLIC_*`), hashed customer data rules
(phone → SHA-256, per Meta's spec) and a retry/outbox so a Meta outage can't
block or duplicate the status change. It must also honour consent: the
server only knows the browser choice if the storefront records it with the
order — that, and whether server-side events need separate consent, are part
of the required security/privacy/legal review. Keep the event id contract
(`purchase_<order id>`) unchanged so browser and server events deduplicate.

## Consent (opt-in) — implemented, pending legal review

Meta tracking is **off by default** and starts only after the visitor
explicitly accepts (`frontend/src/lib/consent.ts`, wired to the tracker's
`consent()` gate in `lib/analytics.ts`; UI `components/ConsentBanner.tsx`).

- Banner (only when a Pixel ID is configured): «موافقة» and «رفض» as equal
  choices (same style), «الإعدادات» with an **unticked** checkbox — nothing
  preselected; the site works the same either way; link to `/privacy`.
- Before a choice and after «رفض»: Meta's script is never loaded and no
  request goes to Meta — on any page, route change or event (Purchase
  included). There is **no `<noscript>` beacon** (a visitor without
  JavaScript can't consent, so nothing is sent for them).
- «موافقة»: the script loads, `init` runs, and the current page's PageView is
  sent; later routes/events follow the normal rules.
- Changing the choice: footer «إعدادات الخصوصية» (or the link on `/privacy`).
  Switching to reject sends `fbq('consent','revoke')` to an already-loaded
  script and drops every later event; switching back sends `grant`.
- Stored in `localStorage` (`ecobel_consent`, versioned — raising
  `CONSENT_VERSION` asks everyone again); unreadable/old/tampered records
  count as "no choice". A choice made in another tab applies in this one.
- Only our explicit events: Meta's automatic events are off
  (`autoConfig false` before `init`) and so is its automatic history-API
  PageView (`disablePushState`).

**Not certified as legally compliant.** The consent behaviour and the privacy
text (`/privacy`, kept `noindex`; review notes in
`docs/PRIVACY_POLICY_DRAFT.md`) must be reviewed by a lawyer before a real
Pixel ID is set in production (Egypt's Personal Data Protection Law no.
151/2020; EU rules if EU visitors are targeted).

Data sent to Meta after consent: page URLs, product ids / prices /
quantities, search terms typed (capped at 100 characters — a visitor could
type anything), cart and checkout values, and for Purchase the order value,
items and the order id (as `eventID`). Never names, phones, addresses,
passwords or tokens. Meta itself also receives the visitor's IP address and
browser details and sets its own cookies (`_fbp`).

## Verifying (before relying on it)

Unit tests: `cd frontend && npm test`. With a real Pixel ID, check events in
Meta Events Manager → Test Events / Pixel Helper on a preview deployment —
this repository has **not** verified that any event reaches Meta.
