# Deploying the Eco Bel storefront

This repository holds two deployable apps:

| App | Path | Runs as | Platform |
|---|---|---|---|
| Storefront (Next.js 16) | `frontend/` | Server-rendered pages + image optimizer | **Vercel** (Root Directory `frontend`) |
| Storefront API (FastAPI) | `backend/` | One long-running uvicorn process | **Render** web service (`render.yaml`) |

They depend on two things outside this repo:

- **Supabase** — the shared PostgreSQL database and the `product-images` Storage bucket.
- **ecobel-accounting-system** — owns the database migrations (it runs them on
  startup), product photo uploads, and online-order administration. The
  storefront API never changes the schema; it only checks that the database is
  at the revision it expects (`EXPECTED_SCHEMA_REVISION` in `backend/app/database.py`)
  and logs a warning if not.

## Why these platforms

- **API on a persistent service, not serverless.** Rate limits and the
  coupon-guessing guard are security controls kept in process memory; the
  SQLAlchemy connection pool and the startup schema check also assume a
  long-lived process. On serverless functions each instance would keep its own
  counters (limits stop working) and its own pool. The API needs no disk: photos
  live in Supabase Storage. Render runs it natively from `render.yaml` in the
  Frankfurt region, closest to the database (Supabase, AWS eu-west-1). Any host
  that runs a single long-lived Python process works the same way (e.g.
  Railway) with the same start command.
- **Storefront on Vercel.** A standard Next.js app (no custom server, no edge
  middleware) using server rendering and the image optimizer, which Vercel runs
  natively. `frontend/vercel.json` pins server rendering to `fra1`, next to the API.

## Order of operations

1. **Database ready.** The production database must be migrated by
   ecobel-accounting-system (start it once against that database, or run
   `alembic upgrade head` there) and be at the revision the API expects.
2. **API on Render.** New → Blueprint → this repository. Enter the `sync: false`
   values when asked (see below). Note the service URL, e.g. `https://ecobel-website-api.onrender.com`.
3. **Storefront on Vercel.** Project → Settings → General → Root Directory =
   `frontend` (framework preset Next.js, default build/install commands). Set the
   environment variables below for **Production** (and **Preview** if you use
   preview deployments — the build fails without them). Deploy.
4. **Connect them.** Set the API's `FRONTEND_ORIGINS` to the storefront's exact
   public origin(s) and redeploy the API.
5. **Custom domain (optional).** Add it in Vercel, then update
   `NEXT_PUBLIC_SITE_URL` (Vercel, redeploy) and `FRONTEND_ORIGINS` (Render).

## Environment variables

Never commit real values, and never put a secret in a `NEXT_PUBLIC_*` variable —
those are compiled into the JavaScript every visitor downloads.

### API (`backend/`, Render)

| Name | Secret? | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Secret | Yes | Shared Supabase PostgreSQL — the same database as ecobel-accounting-system. Use the **Session pooler** URL (IPv4); the direct `db.<ref>.supabase.co` host is IPv6-only. |
| `SECRET_KEY` | Secret | Yes | Signs customer login tokens; 32+ random characters (Render generates it). Different from the accounting system's key. |
| `FRONTEND_ORIGINS` | Public | Yes | Comma-separated storefront origins allowed by CORS, e.g. `https://www.example.com`. https only. |
| `SUPABASE_URL` | Public | Yes (for photos) | `https://<project-ref>.supabase.co`; used only to build public photo URLs. |
| `ENVIRONMENT` | Public | Yes | `production` — hides `/docs` and `/openapi.json`, adds HSTS, refuses unsafe settings at startup. |
| `PYTHON_VERSION` | Public | Render only | `3.13.0` (the version the tests run on). |
| `PRODUCT_IMAGES_BUCKET` | Public | No | Defaults to `product-images`. |
| `PRODUCT_IMAGE_BASE_URL` | Public | No | Overrides the public photo base URL (e.g. a CDN). |

The API never uses a Supabase secret/service-role key. Only
ecobel-accounting-system (`SUPABASE_SECRET_KEY`) can write to Storage.

### Storefront (`frontend/`, Vercel)

| Name | Secret? | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE` | Public | Yes (build fails without it) | The API's public URL, used by browsers and server rendering. |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes (build fails without it) | The storefront's public https origin: canonical links, sitemap, structured data. |
| `NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL` | Public | Yes (build fails without it) | `https://<project-ref>.supabase.co/storage/v1/object/public/product-images` — the only host allowed through the image optimizer and in the CSP. |
| `API_INTERNAL_BASE` | Server-only | No | Different API URL for server rendering only (e.g. a private network address). |

`NEXT_PUBLIC_*` values are read at **build** time: changing one requires a redeploy.

## API start command and proxies

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10"
```

Behind the platform's load balancer every request arrives from the balancer's
address. Without `--proxy-headers`, all customers would share one rate-limit
budget (e.g. 5 orders per minute for the whole store). Only private ranges are
trusted, so uvicorn takes the address the platform appended to
`X-Forwarded-For`, and a client can't fake its address. Never use
`--forwarded-allow-ips="*"`: uvicorn then trusts the leftmost entry, which the
client controls.

Run **one instance with one worker**: the limits live in process memory.

## After deploying — checks

- `GET https://<api>/` → `{"status":"ok"}`; `GET https://<api>/docs` → 404.
- Render logs at startup show no "schema is at … but this service expects" warning.
- Render access log: your own requests show **your** public IP, not a `10.x`/`172.x`
  address. If they show the load balancer's address, the platform's proxy range
  differs — adjust `--forwarded-allow-ips` to it (still never `*`).
- Storefront home, catalog and a product page load with prices; product photos
  load from the Supabase host.
- Browser console has no CORS or Content-Security-Policy errors.
- `https://<site>/sitemap.xml` lists the products; `https://<site>/robots.txt`
  points at it.
- Place a test order and a cart quote from the live storefront; cancel the test
  order from the accounting admin.
