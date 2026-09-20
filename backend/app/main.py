import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .routers import staff_router, catalog, coupons, orders, account
from .routers.staff_router import limiter

# Schema is managed by Alembic (see alembic/ and the README) — run
# `alembic upgrade head` before starting the server.

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

app.include_router(staff_router.router)
app.include_router(account.router)
app.include_router(catalog.router)
app.include_router(coupons.router)
app.include_router(orders.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "ecobel-website-api"}
