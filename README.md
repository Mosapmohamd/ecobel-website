# Eco Bel — Website

Public e-commerce site for Eco Bel (skincare/haircare brand). Phase 1 of
the Eco Bel digital project — built from scratch on the existing domain
and hosting, sharing its product/inventory data with
[ecobel-accounting-system](https://github.com/Mosapmohamd/ecobel-accounting-system)
(same database) rather than duplicating it.

- [`backend/`](./backend) — FastAPI + SQLAlchemy API: catalog, cash-on-delivery
  checkout, coupons, order tracking, staff order management (see its README
  for setup — **read the "shares a database" section first**)
- [`frontend/`](./frontend) — Next.js storefront (catalog, cart, checkout,
  order tracking)

## Status

Backend and frontend both working end-to-end: catalog, cart, checkout,
coupons, order tracking, and staff endpoints are built and tested. Not yet
built: customer accounts, wishlist/compare, product images, notifications.
