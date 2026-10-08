from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import checkout, pricing, schemas
from ..database import get_db
from ..rate_limit import limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/cart", tags=["Cart"])


@router.post("/quote", response_model=schemas.CartQuote)
@limiter.limit("60/minute")
def quote_cart(request: Request, payload: schemas.CartQuoteRequest, db: Session = Depends(get_db)):
    """Prices a browser cart (product ids + quantities) — plus the coupon
    and delivery city when given — with the same rules checkout uses. The
    storefront shows these numbers instead of computing its own, so the
    total on screen is the total the order is charged."""
    lines = pricing.quote_lines(db, payload.items)
    orderable = [line for line in lines if line.issue is None]
    subtotal = sum(line.line_total for line in orderable)
    regular_subtotal = sum(line.regular_unit_price * line.quantity for line in orderable)
    t = checkout.totals(db, subtotal, city=payload.city, coupon_code=payload.coupon_code, client=get_remote_address(request))
    code = (payload.coupon_code or "").strip()
    return schemas.CartQuote(
        lines=lines,
        subtotal=subtotal,
        regular_subtotal=regular_subtotal,
        savings=round(regular_subtotal - subtotal, 2),
        has_issues=any(line.issue for line in lines),
        coupon=schemas.CouponStatus(code=code.upper(), valid=t.coupon is not None, reason=t.coupon_error) if code else None,
        discount=t.discount,
        shipping_fee=t.shipping_fee,
        city_error=t.city_error,
        free_shipping_threshold=checkout.FREE_SHIPPING_THRESHOLD,
        total=t.total,
    )
