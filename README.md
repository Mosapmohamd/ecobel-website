# Eco Bel — Website

Public e-commerce site for Eco Bel (Egyptian skincare/haircare brand).
Built from scratch on the existing domain and hosting, sharing its
product/inventory/order data with
[ecobel-accounting-system](https://github.com/Mosapmohamd/ecobel-accounting-system)
(same Supabase/PostgreSQL database) rather than duplicating it. All admin
work — product/coupon/offer/routine management, order status updates,
shipping rates, review moderation, sales analytics — lives in that
repo's dashboard, not here. This repo is the public storefront only.

- [`backend/`](./backend) — FastAPI + SQLAlchemy API (see its README for
  setup — **read the "shares a database" section first**)
- [`frontend/`](./frontend) — Next.js storefront

## What's built

**Catalog & discovery**
- Category browsing, full-text search, sort (price, name), price-range
  filter
- Homepage sections for **offers** (single-product discounts) and
  **routines** (curated 2–3 product bundles) — separate from the general
  catalog, not mixed into it
- Product detail page: breadcrumb, offer pricing (struck-through original
  + badge when applicable), a bordered trust block (shipping / COD /
  returns / natural ingredients), and related products from the same
  category

**Reviews**
- A customer can review a product only if they've actually ordered it
  before (checked server-side against their order history — never
  trusted from the client)
- New reviews are hidden until a staff member approves them from the
  accounting system's moderation queue; the product page shows the
  average rating, review count, and the approved reviews only

**Cart & checkout**
- Cash-on-delivery checkout with server-side re-pricing (nothing about
  totals, prices, or discounts is ever taken from the client)
- Delivery fee driven by a city dropdown (populated from the shipping
  rates the admin configures — not free text), with a free-shipping
  threshold
- Coupon validation against the live subtotal
- Name (must be three space-separated parts) and phone
  (`01XXXXXXXXX`) are validated both client- and server-side
- Order tracking by order number + phone (either alone returns a
  status-only summary, both together return full details)

**Accounts & self-service**
- Customer registration/login; a guest checkout automatically upgrades
  to a real account if they register with the same phone number later
- A customer can edit (add/remove items, change address) or cancel their
  own order from their account page, but only while it's still
  "pending" — once staff mark it as shipped, it's locked. Editing/
  cancelling correctly restores reserved stock and reverses the
  recorded revenue

**Design**
- Rose/blush brand palette (white-dominant canvas, a single action
  color, near-sharp corners) informed by a structural + visual analysis
  of comparable skincare storefronts — see commit history for the full
  rationale
- The real Eco Bel logo (transparent black/white variants + a
  brand-colored favicon, generated from the source artwork)

## Status

Backend and frontend working end-to-end and covered by real (not just
type-checked) integration tests run against both services together:
catalog, search, wishlist, offers, routines, cart, checkout (incl.
city-based shipping and validation), coupon validation, order tracking,
customer accounts, order self-service editing/cancellation, and product
reviews.

Not yet built: order-confirmation notifications (WhatsApp/email).
