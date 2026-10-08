import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .security import DOCS_SETTINGS, SecurityHeadersMiddleware, check_production_config
from .auth import SECRET_KEY
from .database import DATABASE_URL, check_schema_revision
from .routers import catalog, cart, orders, account, reviews
from .rate_limit import limiter

# The shared schema is migrated by ecobel-accounting-system; this service
# only checks it's at the revision these models expect. Product images,
# coupon management, and online-order admin also live there — this
# service is the public storefront only.
check_schema_revision()

app = FastAPI(
    **DOCS_SETTINGS,  # no public API docs in production
    title="Eco Bel — Website API",
    description="Public storefront API: catalog, checkout, "
                "order tracking, and customer accounts. Shares its database "
                "with ecobel-accounting-system, which owns all admin actions.",
    version="0.1.0",
)

app.state.limiter = limiter


# Customer-facing errors are always one Arabic sentence in `detail` — never
# a framework's English text or a list of field paths.
@app.exception_handler(RateLimitExceeded)
async def _too_many_requests(request: Request, exc: RateLimitExceeded):
    return JSONResponse({"detail": "محاولات كتير ورا بعض — استني دقيقة وحاولي تاني"}, status_code=429)


@app.exception_handler(RequestValidationError)
async def _invalid_request(request: Request, exc: RequestValidationError):
    # Our own validators (name, phone) already raise Arabic messages; any
    # other constraint gets a generic Arabic line.
    detail = "البيانات اللي اتبعتت مش مكتملة أو مش صحيحة — راجعيها وحاولي تاني"
    for err in exc.errors():
        if err.get("type") == "value_error":
            detail = str(err.get("ctx", {}).get("error") or err.get("msg", detail))
            break
    return JSONResponse({"detail": detail}, status_code=422)

app.add_middleware(SlowAPIMiddleware)

FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
FRONTEND_ORIGINS = [o.strip() for o in FRONTEND_ORIGINS if o.strip()]
check_production_config(SECRET_KEY, FRONTEND_ORIGINS, DATABASE_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(account.router)
app.include_router(catalog.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(reviews.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "ecobel-website-api"}
