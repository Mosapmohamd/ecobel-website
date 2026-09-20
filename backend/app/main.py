import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from . import models
from .database import engine
from .schema_sync import ensure_columns
from .routers import staff_router, catalog, coupons, orders, account, admin
from .routers.staff_router import limiter

# Creates any tables that don't already exist yet (won't touch or drop
# tables that are already there — safe to run every time the app starts,
# including against a database that already has the shared
# categories/products/etc. tables from ecobel-accounting-system).
models.Base.metadata.create_all(bind=engine)
ensure_columns(engine)  # adds any new columns (e.g. products.image_url) to existing tables

# Where uploaded product images are stored/served from. Created on first run.
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
os.makedirs(os.path.join(STATIC_DIR, "products"), exist_ok=True)

app = FastAPI(
    title="Eco Bel — Website API",
    description="Public storefront API (catalog, checkout, order tracking) "
                "plus staff-only order/coupon management. Shares its "
                "database with ecobel-accounting-system.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Comma-separated allowed origins — the storefront frontend (Next.js dev
# server on :3000 by default) and, if ever needed, a staff dashboard.
FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(staff_router.router)
app.include_router(account.router)
app.include_router(catalog.router)
app.include_router(coupons.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "ecobel-website-api"}
