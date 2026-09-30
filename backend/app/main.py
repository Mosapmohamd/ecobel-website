import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from . import models
from .database import engine
from .routers import catalog, coupons, orders, account, reviews
from .rate_limit import limiter

# Creates any tables that don't already exist yet (won't touch or drop
# tables that are already there). Product images, coupon management, and
# online-order admin all live in ecobel-accounting-system now — this
# service is the public storefront only.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Eco Bel — Website API",
    description="Public storefront API: catalog, checkout, coupon validation, "
                "order tracking, and customer accounts. Shares its database "
                "with ecobel-accounting-system, which owns all admin actions.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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

app.include_router(account.router)
app.include_router(catalog.router)
app.include_router(coupons.router)
app.include_router(orders.router)
app.include_router(reviews.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "ecobel-website-api"}
