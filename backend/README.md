# Eco Bel — Website (Backend)

FastAPI + SQLAlchemy backend for the public storefront: catalog browsing,
cash-on-delivery checkout, coupon codes, and order tracking — plus a
staff-only API for managing orders and coupons.

## ⚠️ Shares a database with ecobel-accounting-system

This service does **not** have its own copy of the product catalog. It
reads and writes the same `categories`, `products`, `inventory_movements`,
and `finance_entries` tables as [ecobel-accounting-system](../ecobel-accounting-system) —
same `DATABASE_URL` in both `.env` files, same Postgres database in
production.

**Why:** the accounting team manages products/stock/categories in one
place; the website should never show stale prices or oversell stock.

**What this means for schema changes:**
- `app/models.py` defines those four tables identically to how
  ecobel-accounting-system defines them. If a column changes there, mirror
  the change here (and vice versa) — they must always match exactly.
- This service's Alembic migrations only create/alter its own tables
  (`customers`, `coupons`, `orders`, `order_items`, `staff_users`).
  `alembic upgrade head` here will fail if the shared tables don't already
  exist — run the accounting system's migrations against the shared
  database first.
- A longer-term fix worth considering once both services stabilize: pull
  the shared models into their own small Python package so there's exactly
  one definition instead of two kept in sync by hand.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env            # DATABASE_URL must match ecobel-accounting-system's
```

### First-time schema setup

**Real shared database, local or production** — point *both* services'
`DATABASE_URL` at the exact same database (a shared PostgreSQL instance
in production; for local dev, the quickest option is one shared SQLite
file — see below), then run the accounting system's migrations **first**
(it owns the shared tables), then this service's:

```bash
# in ecobel-accounting-system/backend
alembic upgrade head

# then, in this repo
alembic upgrade head
```

Each service tracks its own migration history in a separate table
(`alembic_version_accounting` / `alembic_version_website`) specifically
so both can coexist in one database — this is already set up in each
repo's `alembic/env.py`, nothing to configure.

**Local shared-SQLite-file setup**, in both backends' `.env`:

```bash
DATABASE_URL=sqlite:////absolute/path/to/a/shared/ecobel_shared_dev.db
```

(Windows: `sqlite:///C:/path/to/ecobel_shared_dev.db`.) Verified working:
a product created via the accounting system's API shows up immediately
in this service's `/catalog/products`.

**Working on this service completely standalone** (no accounting system
running at all, e.g. to test just the storefront)? Bootstrap the shared
tables locally instead:

```bash
python dev_bootstrap_shared_tables.py   # creates categories/products/etc. locally only
alembic upgrade head                     # creates this service's own tables
```

Create a staff account (prompts for the password):

```bash
python create_staff.py staff1
```

Run the server:

```bash
uvicorn app.main:app --reload --port 8001
```

(`--port 8001` avoids colliding with the accounting system's backend on
8000 if you run both locally at once.) Interactive API docs:
http://localhost:8001/docs

## API overview

```
Public (no auth):
  GET  /catalog/categories
  GET  /catalog/products?category_id=...
  GET  /catalog/products/{id}
  POST /coupons/validate           { code, order_subtotal } -> discount preview
  POST /orders/                    checkout — see below
  GET  /orders/track?order_number=..&phone=..   (both must match — see Security)

Staff (Bearer token from POST /staff/login):
  GET   /coupons/
  POST  /coupons/
  GET   /orders/?status=...
  PATCH /orders/{id}/status
```

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

Server-side, in order: re-prices every line from the current `Product.sale_price`
(the client's own total is never trusted), validates the coupon (if any)
against the *recomputed* subtotal, applies shipping (flat 50 EGP, waived at
1000 EGP net of discount — see `SHIPPING_FEE` / `FREE_SHIPPING_THRESHOLD` in
`routers/orders.py`), deducts stock via the same `InventoryMovement`
pattern the accounting system uses (`website_sale` type, rejects if stock
is insufficient), and records a `FinanceEntry` (category "مبيعات الموقع")
— so accounting's dashboard picks up website sales automatically, same as
it already does for B2B orders.

Payment is cash-on-delivery only for now, matching the current project
scope; `Order.payment_method` exists as a field so an online gateway can
be added later without a schema change.

## Security notes

Same hardened patterns as ecobel-accounting-system, applied from the start
here rather than retrofitted:

- `SECRET_KEY` is required outside local SQLite dev (fails fast otherwise).
- `/staff/login` is rate-limited to 5 attempts/minute per IP.
- CORS is restricted to `FRONTEND_ORIGINS`, not `*`.
- Numeric inputs are bounds-checked (order quantities > 0, coupon values
  sane, coupon subtotal >= 0).
- `create_staff.py` prompts for the password instead of taking it as a
  plain CLI argument.
- **Order tracking requires both the order number and the phone number**
  used at checkout — an order number alone (which could leak via a
  screenshot, a shared link, etc.) can't be used to pull up someone else's
  address and order contents.
- Checkout always re-prices from the database; nothing about the order
  total, unit prices, or discount is ever taken from the request body
  except product IDs, quantities, and the coupon code.
- **`POST /orders/`, `POST /coupons/validate`, and `GET /orders/track` are
  rate-limited** (5/minute per IP) — these are the only public write/probe
  endpoints, and without a limit any of them could be scripted: exhausting
  real stock with junk orders, brute-forcing coupon codes, or brute-forcing
  an order number against a known phone number.
- **Checkout caps items per order (≤30) and quantity per line (≤100)** as
  defense-in-depth against a single oversized request.
- **Stock rows are locked (`SELECT ... FOR UPDATE`) during checkout** to
  close a race condition where two concurrent orders for the last unit
  could both pass the stock check before either commits, overselling.
  (No-op on SQLite; effective on the real PostgreSQL target.)
- `/catalog/products` caps its page size (`limit`, max 200).

## Not yet built (future work)

- Customer accounts / login ("My Account") — `Customer.hashed_password`
  exists in the model but there's no registration/login flow yet; every
  checkout today is effectively a guest checkout that finds-or-creates a
  `Customer` row by phone number.
- Wishlist, product comparison, quick-view, product reviews/ratings —
  planned Phase 1 features, not started.
- WhatsApp/email order-confirmation notifications.
- Product images (no image field/storage wired up yet).
- The frontend itself — this is backend only so far.
