# Eco Bel — Website

Public e-commerce site for Eco Bel (skincare/haircare brand). Phase 1 of
the Eco Bel digital project — built from scratch on the existing domain
and hosting, sharing its product/inventory data with
[ecobel-accounting-system](https://github.com/Mosapmohamd/ecobel-accounting-system)
(same database) rather than duplicating it.

- [`backend/`](./backend) — FastAPI + SQLAlchemy API: catalog, cash-on-delivery
  checkout, coupon validation, order tracking, customer accounts (see its
  README for setup — **read the "shares a database" section first**)
- [`frontend/`](./frontend) — Next.js storefront (catalog, wishlist, search,
  cart, checkout, order tracking, customer accounts)

All admin functionality (product/category management, coupon management,
online-order status updates, sales analytics) lives in
ecobel-accounting-system, not here — this repo is the public storefront
only.

## Status

Backend and frontend working end-to-end: catalog, search, wishlist, cart,
checkout, coupon validation, order tracking, and customer accounts are
built and tested. Not yet built: product comparison/quick-view/reviews,
order-confirmation notifications.
