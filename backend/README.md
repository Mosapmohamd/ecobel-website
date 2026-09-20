# Eco Bel — Website (Backend)

FastAPI + SQLAlchemy backend for the public storefront: catalog browsing,
cash-on-delivery checkout, coupon codes, and order tracking — plus a
staff-only API for managing orders and coupons.

## ⚠️ Shares a database with ecobel-accounting-system

This service does **not** have its own copy of the product catalog. It
reads and writes the same `categories`, `products`, `inventory_movements`,
and `finance_entries` tables as [ecobel-accounting-system](../ecobel-accounting-system) —
same `DATABASE_URL` in both `.env` files, same database in production.

**Why:** the accounting team manages products/stock/categories in one
place; the website should never show stale prices or oversell stock.

**What this means for schema changes:** `app/models.py` defines those
four tables identically to how ecobel-accounting-system defines them. If
a column changes there, mirror the change here (and vice versa) — they
must always match exactly. A longer-term fix worth considering once both
services stabilize: pull the shared models into their own small Python
package so there's exactly one definition instead of two kept in sync by
hand.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env            # DATABASE_URL must match ecobel-accounting-system's
```

### Database — no separate migration step

The app creates any tables it doesn't find yet the moment it starts
(`Base.metadata.create_all` in `app/main.py`) — there's no `alembic
upgrade` or similar command to remember to run. This is safe against a
database that already has data: it only creates tables that don't exist
yet and never touches or drops existing ones, so pointing this service at
a copy of the accounting system's database (with real products already
in it) just adds this service's own tables (`customers`, `coupons`,
`orders`, `order_items`, `staff_users`) alongside the existing data.

**Quickest way to get real product data locally**: copy the accounting
system's `ecobel_dev.db` file into this service's `backend/` folder and
point `DATABASE_URL` at it (the default, `sqlite:///./ecobel_dev.db`,
already expects it right there) — no need to run the accounting system
at the same time once the data's copied over.

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
  POST /orders/                    checkout — see below (auth optional — see Customer accounts)
  GET  /orders/track?order_number=..&phone=..   (both must match — see Security)
  POST /account/register           creates an account, returns a token
  POST /account/login              { phone, password } -> token

Customer (Bearer token from POST /account/register or /account/login):
  GET   /account/me
  PATCH /account/me
  GET   /account/orders            the logged-in customer's own order history

Staff (Bearer token from POST /staff/login):
  GET   /coupons/
  POST  /coupons/
  GET   /orders/?status=...
  PATCH /orders/{id}/status
```

### Customer accounts

Registration is optional — checkout works the same for guests. When
`POST /orders/` is called *with* a customer's Bearer token, the order is
linked to their account (`Order.customer_id`) instead of doing the
phone-based guest find-or-create, and it then shows up in
`GET /account/orders`. Registering with a phone number that already has
guest orders under it upgrades that existing `Customer` row into a real
account rather than creating a duplicate.

Customer tokens and staff tokens are both JWTs signed with the same
`SECRET_KEY`, but carry a `type` claim (`"customer"` vs `"staff"`) that
each endpoint's auth dependency checks — a customer token can't be used
against staff-only endpoints and vice versa, even though the low-level
encoding is otherwise identical.

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

- Product comparison, quick-view, product reviews/ratings.
- WhatsApp/email order-confirmation notifications.
