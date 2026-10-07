# EcoBel Development Phases — Storefront (ecobel-website)

The EcoBel system is two repositories sharing one PostgreSQL (Supabase)
database: this storefront (Next.js + FastAPI) and
`ecobel-accounting-system` (admin/accounting, React + FastAPI). This file
records what each development phase delivered **in this repository**.

## How this history is committed

Phases 1–4 were developed as uncommitted work and checkpointed together in
**one commit** (see *Checkpoint commit* below). Exact per-phase commits
could not be reconstructed safely: about 40 files were changed by several
phases, several edits were made by scripts that left no intermediate
snapshots, and the working tree also contained earlier uncommitted work.
Rather than invent a history, the phases are described here.

That checkpoint also contains work done **before Phase 1** that had not been
committed (after `44dce04`): an in-site dialog fix (Oct 3) and
admin-editable homepage banner support (Oct 6), which Phase 1 built on.

---

## Phase 1 — Design system & homepage

**Objective:** a coherent Arabic-first (RTL) storefront in the Stitch/EcoBel
visual language, with a homepage built from real data.

**Scope / major changes**
- Design tokens centralised in `src/app/globals.css` (colours, type scale,
  radius, spacing, containers); Tajawal + Markazi Text via `next/font`.
- Header (one row, categories menu, routines entry, search), PromoBar,
  Footer.
- Homepage order: promo → header → hero → trust → categories → offers →
  featured products → featured routines → brand story → reviews → closing
  CTA → footer.
- `HeroCarousel`: RTL track, autoplay with pause on hover/focus/touch/hidden
  tab, edge hover controls (no dots, no pause button), swipe,
  `prefers-reduced-motion` (no autoplay). Banners are configured in
  `src/lib/heroSlides.ts` (`mobileImage` slot ready for phone crops).
- Category tiles (`CategoryIconRow`) including a routines tile;
  `SectionHeader`, `TrustStrip`, `BrandStory`, `HomeReviews` (real reviews
  only), `ClosingCta`.
- Product image fallback (brand-toned surface, never invented photography).
- Loading, empty and error states on every data section.

**Architecture decisions:** no invented content or claims; only staff data
from the API is shown; the existing palette was reused (no new colours).

**Testing:** visual checks with headless Edge at desktop and phone widths;
type-check, lint and build.

## Phase 2 — Catalog, routines & merchandising

**Objective:** a real catalog with routines as a first-class category, and
homepage placement controlled by staff.

**Scope / major changes**
- Backend `app/pricing.py`: the single source of product prices (live
  offers, lowest offer wins, offers above the price never apply).
- Catalog API: server-side search (name, description, SKU, category),
  price/offer filters, sorting, pagination; `max_quantity` instead of exact
  stock; `/catalog/products/{id}/related`; routines list/detail;
  `/catalog/featured-products` (≤ 8) and `/catalog/featured-routines` (≤ 2)
  in staff order, skipping unsellable items without back-filling.
- `/cart/quote`: the cart priced by the server.
- Storefront: catalog page with all filters in the URL; product detail
  (offer pricing, real ratings, related products); `/routines` and
  `/routines/[id]`; cart and wishlist store ids only (prices always from
  the server).

**Architecture decisions:** merchandising lives in its own tables
(`featured_products`, `featured_routines`, managed in the admin); prices are
never computed in the browser.

**Testing:** `tests/test_catalog_and_pricing.py`; end-to-end catalog, search,
filters, routines and featured checks.

## Phase 3 — Commerce lifecycle

**Objective:** correct, server-validated cart → checkout → order flow with
in-site confirmations.

**Scope / major changes**
- `app/checkout.py`: coupon, city shipping and final total in one place,
  used by the cart quote and by order creation/editing. Only cities with an
  active rate can be delivered to.
- Orders: stock checked against merged lines, fixed lock order, coupon row
  locking, friendly Arabic errors, field limits, coupon uses released on
  cancellation; Arabic 422/429 responses.
- Storefront: checkout totals from the quote, coupon apply/remove, clear-cart
  confirmation, order editor with catalog search and city change, shared
  order status badge and totals, tracking page.

**Phase 1–3 fix batch (after the Phase 1–3 audit, before Phase 4)**
- **Guest/account ownership (H1):** guest profiles and accounts are separate
  identities; guest checkout never attaches to an account; registration
  never takes over guest orders; login only matches accounts. Enforced by
  partial unique indexes (one account and one guest profile per phone).
- **Schema ownership:** the shared schema is migrated only by
  `ecobel-accounting-system`; this service no longer runs `create_all` and
  only checks `EXPECTED_SCHEMA_REVISION` (`app/database.py`).
- **Arabic validation:** forms use `noValidate` + shared validators
  (`src/lib/validation.ts`, `FieldError`).
- **Auth resilience:** typed `ApiError`, request timeout; only a 401 ends a
  session — network/5xx/timeout keep it (`src/lib/auth.tsx`).
- **Routine search:** `/catalog/routines?q=`; matching routines shown in
  catalog search.

**Testing:** `tests/test_checkout_and_orders.py`,
`tests/test_order_ownership.py`; end-to-end checkout, coupons, tracking,
editing, cancellation, ownership and auth-failure scenarios.

## Phase 4 — Product images

**Objective:** real product photos that work in every environment.

**Scope / major changes**
- Photos live in **Supabase Storage** (bucket `product-images`, public read;
  only the accounting backend can write, with a server-only key).
- The database stores `products.image_key` (e.g.
  `products/<id>/<random>.webp`); `app/product_images.py` builds the public
  URL from `SUPABASE_URL` (or `PRODUCT_IMAGE_BASE_URL`). No secret is used
  here.
- `next.config.ts`: the image optimizer accepts only the configured image
  host; 30-day cache for resized copies; local IPs only for a local host.
- `src/lib/image.ts` is the single URL resolver (unknown or legacy values →
  fallback). `ProductImage`: loading pulse, fallback on missing/failed
  photos, `preload` for the product-detail photo only; correct `sizes`.

**Database migration:** `0003_product_image_key` (in the accounting
repository) renames `products.image_url` → `image_key`;
`EXPECTED_SCHEMA_REVISION` here is `0003_product_image_key`.

**Security:** uploads and deletes are staff-only (accounting API); this API
has no upload route; no storage secret in any frontend bundle.

**Image lifecycle:** upload → Storage → `image_key` → API `image_url` →
`ProductImage` → Next.js optimizer; replace deletes the old object; delete
clears the key and shows the fallback.

**Testing:** `tests/test_catalog_and_pricing.py` (URLs built from keys);
end-to-end against a Storage stand-in (48 checks) and against real Supabase
Storage (upload, replace, delete, storefront display).

---

## Verified results at this checkpoint

| Check | Result |
|---|---|
| Backend tests (`cd backend && python -m pytest -q`) | 33 passed |
| Type-check / lint / production build | pass / 0 problems / pass |
| End-to-end: storefront 84/84, fix batch 20/20, real Supabase image lifecycle 22/23* |  |

\* The failing check expected a deleted photo URL to stop responding
immediately; Supabase's CDN keeps a cached copy for up to ~65 s (measured).
The object itself is deleted at once.

The end-to-end suites are Playwright scripts that were run against isolated
throwaway databases; they are not part of this repository.

## Known open items (not part of Phases 1–4)

- `SECRET_KEY`: the currently configured development value is also present
  in this repository's public history — use a new random value before any
  non-local deployment.
- Phone-sized hero banner crops (design assets) are still to be supplied.
- SEO, Lighthouse, accessibility audit, further security hardening → Phase 5.

## Checkpoint commit

See the commit that adds this file (`git log --follow docs/PHASES.md`).

## Current status

- Phase 1: COMPLETE
- Phase 2: COMPLETE
- Phase 3: COMPLETE
- Phase 4: COMPLETE
- Phase 5: NOT STARTED
