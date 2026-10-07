# Eco Bel — Website (Frontend)

Next.js (App Router) + TypeScript storefront for the [backend](../backend)
API. Same brand identity as the rest of the Eco Bel project (forest green
/ gold / parchment, Tajawal + Markazi Text).

## Setup

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE if the backend isn't on :8002
npm run dev
```

Make sure the backend's `FRONTEND_ORIGINS` includes this frontend's origin
(`http://localhost:3000` by default in dev — already the default on the
backend side; only needs changing for a non-default port or in
production).

## Pages

- **Home** (`/`) — hero, category tiles, featured products
- **Products** (`/products?category=...`) — full catalog with category filter
- **Product detail** (`/products/[id]`) — quantity picker, add to cart
- **Cart** (`/cart`) — persisted in `localStorage`, editable quantities
- **Checkout** (`/checkout`) — contact/address form, coupon code, live
  order summary, cash-on-delivery confirmation
- **Track order** (`/track`) — look up by order number + phone (also
  auto-fills and looks up when arriving from the post-checkout link)

## Notes

- Cart state lives entirely in the browser (`localStorage`) — there's no
  server-side cart. Checkout re-prices everything from the backend anyway,
  so a stale cart price is never actually charged.
- `NEXT_PUBLIC_API_BASE` is inlined into the client bundle at **build
  time** — changing it requires a rebuild (`npm run build`), not just a
  restart, when running the production build (`npm run start`). `npm run
  dev` picks up `.env.local` changes on its own.
- No product images yet — `ProductGlyph` in `components/ProductCard.tsx`
  is a placeholder illustration standing in until real photos exist.
