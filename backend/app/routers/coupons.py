from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..rate_limit import limiter

router = APIRouter(prefix="/coupons", tags=["Coupons"])


def _validate_coupon(db: Session, code: str, order_subtotal: float) -> tuple[models.Coupon | None, str | None, float]:
    """Returns (coupon, error_reason, discount_amount). coupon is None iff error_reason is set.
    Coupons themselves are created/managed in the accounting system; the
    website only validates and applies them at checkout."""
    coupon = db.query(models.Coupon).filter(models.Coupon.code == code.strip().upper()).first()
    if not coupon or not coupon.is_active:
        return None, "الكوبون غير موجود أو غير مفعّل", 0
    if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc):
        return None, "الكوبون منتهي الصلاحية", 0
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return None, "الكوبون وصل للحد الأقصى من الاستخدام", 0
    if order_subtotal < coupon.min_order_amount:
        return None, f"الحد الأدنى للطلب مع الكوبون ده {coupon.min_order_amount:.0f} ج.م", 0

    if coupon.discount_type == models.CouponDiscountType.percentage:
        discount = order_subtotal * (coupon.discount_value / 100)
    else:
        discount = coupon.discount_value
    discount = min(discount, order_subtotal)
    return coupon, None, discount


@router.post("/validate", response_model=schemas.CouponValidateResponse)
@limiter.limit("5/minute")
def validate_coupon(request: Request, payload: schemas.CouponValidateRequest, db: Session = Depends(get_db)):
    coupon, reason, discount = _validate_coupon(db, payload.code, payload.order_subtotal)
    if not coupon:
        return schemas.CouponValidateResponse(valid=False, reason=reason)
    return schemas.CouponValidateResponse(valid=True, discount_amount=discount)
