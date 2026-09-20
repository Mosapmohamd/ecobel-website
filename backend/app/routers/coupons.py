from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/coupons", tags=["Coupons"])


def _validate_coupon(db: Session, code: str, order_subtotal: float) -> tuple[models.Coupon | None, str | None, float]:
    """Returns (coupon, error_reason, discount_amount). coupon is None iff error_reason is set."""
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
    discount = min(discount, order_subtotal)  # never discount below zero
    return coupon, None, discount


@router.post("/validate", response_model=schemas.CouponValidateResponse)
def validate_coupon(payload: schemas.CouponValidateRequest, db: Session = Depends(get_db)):
    coupon, reason, discount = _validate_coupon(db, payload.code, payload.order_subtotal)
    if not coupon:
        return schemas.CouponValidateResponse(valid=False, reason=reason)
    return schemas.CouponValidateResponse(valid=True, discount_amount=discount)


# ---------------- Staff management ----------------
@router.get("/", response_model=List[schemas.CouponOut], dependencies=[Depends(auth.get_current_staff)])
def list_coupons(db: Session = Depends(get_db)):
    return db.query(models.Coupon).order_by(models.Coupon.created_at.desc()).all()


@router.post("/", response_model=schemas.CouponOut, status_code=201, dependencies=[Depends(auth.get_current_staff)])
def create_coupon(payload: schemas.CouponCreate, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(400, "كود الكوبون مطلوب")
    if db.query(models.Coupon).filter(models.Coupon.code == code).first():
        raise HTTPException(400, "الكود ده مستخدم بالفعل")
    if payload.discount_type == models.CouponDiscountType.percentage and payload.discount_value > 100:
        raise HTTPException(400, "نسبة الخصم لازم تكون 100% أو أقل")

    coupon = models.Coupon(
        code=code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        min_order_amount=payload.min_order_amount,
        max_uses=payload.max_uses,
        expires_at=payload.expires_at,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon
