# Eco Bel — Website (Backend)

FastAPI + SQLAlchemy backend for the public storefront: catalog browsing,
cash-on-delivery checkout, coupon validation, order tracking, and customer
accounts.

## ⚠️ Shares a database with ecobel-accounting-system

This service doesn't own its data — it reads and writes tables that
[ecobel-accounting-system](../ecobel-accounting-system) also uses, same
`DATABASE_URL` in both `.env` files:

- `categories`, `products`, `inventory_movements`, `finance_entries` —
  owned by the accounting system (product catalog, stock).
- `customers`, `coupons`, `orders`, `order_items` — this service writes
  these at checkout/registration, but **all admin management of them
  (coupon CRUD, order status updates, sales analytics) lives in the
  accounting system**, not here. This service only *validates* a coupon
  and *creates* orders; it doesn't manage either.

**What this means for schema changes:** `app/models.py` defines the tables
above identically to how the accounting system defines them. If a column
changes on either side, mirror the change on the other.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env            # DATABASE_URL must match ecobel-accounting-system's
```

### Database schema — migrated by ecobel-accounting-system

This service never creates or alters tables. The shared database's schema
has one migration history, owned and applied by ecobel-accounting-system
(start it first, or together). On startup this service logs a warning if
the database isn't at `EXPECTED_SCHEMA_REVISION` (`app/database.py`) —
bump that when a new migration changes a table this service maps.

Run the server:

```bash
uvicorn app.main:app --reload --port 8002
```

(`--port 8002` avoids colliding with the accounting system's backend on
8000 if you run both locally.) Interactive API docs: http://localhost:8002/docs

## API overview

```
Public (no auth):
  GET  /catalog/categories
  GET  /catalog/products?category_id=...&q=...
  GET  /catalog/products/{id}
  POST /coupons/validate           { code, order_subtotal } -> discount preview
  POST /orders/                    checkout — see below (auth optional)
  GET  /orders/track?order_number=..&phone=..   (either alone, or both — see Security)
  POST /account/register           creates an account, returns a token
  POST /account/login              { phone, password } -> token

Customer (Bearer token from POST /account/register or /account/login):
  GET   /account/me
  PATCH /account/me
  GET   /account/orders            the logged-in customer's own order history
```

Everything staff-facing (coupon management, order status updates, product
CRUD, sales analytics) is in the accounting system's API instead — see
its README.

### Checkout (`POST /orders/`)

```json
{
  "customer_name": "أحمد محمد",
  "customer_phone": "01011112222",
  "shipping_address": "6 أكتوبر، الجيزة",
  "items": [{"product_id": "...", "quantity": 2}],
  "coupon_code": "ECO10",
  "note": "optional"
}
```

Server-side: re-prices every line from the current `Product.sale_price`
(the client's own total is never trusted), validates the coupon (if any)
against the recomputed subtotal, applies shipping (flat 50 EGP, waived at
1000 EGP net of discount), deducts stock via the same `InventoryMovement`
pattern the accounting system uses, and records a `FinanceEntry` so the
accounting dashboard picks up website sales automatically.

If the request carries a valid customer Bearer token, the order is linked
to that account (`Order.customer_id`) instead of the phone-based guest
find-or-create, and shows up in `GET /account/orders`.

## Security notes

- `SECRET_KEY` is required outside local SQLite dev (fails fast otherwise).
- `POST /orders/`, `POST /coupons/validate`, and `GET /orders/track` are
  rate-limited (5/minute per IP) — the only public write/probe endpoints.
- CORS is restricted to `FRONTEND_ORIGINS`, not `*`.
- Numeric inputs are bounds-checked (order quantities > 0, coupon subtotal
  >= 0, checkout capped at 30 items / 100 qty per line).
- **Order tracking**: giving both the order number and phone returns full
  details; either one alone returns a status-only summary (no address) —
  knowing just one credential shouldn't expose someone's delivery address.
- Checkout always re-prices from the database; nothing about totals,
  prices, or discounts is ever taken from the request body except product
  IDs, quantities, and the coupon code.
- Product rows are locked (`SELECT ... FOR UPDATE`) during checkout to
  avoid two concurrent orders overselling the last unit.
- `/catalog/products` caps its page size (`limit`, max 200).

## Not yet built (future work)

- Product comparison, quick-view, product reviews/ratings.
- WhatsApp/email order-confirmation notifications.
