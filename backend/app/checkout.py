"""Checkout totals — coupon, shipping and the final amount.

The cart quote (what the customer sees) and order creation/editing (what
the order is charged) both go through `totals()`, so the storefront never
re-implements discount or shipping rules of its own.

Shipping: free at FREE_SHIPPING_THRESHOLD (after discount); otherwise the
fee staff configured for the city in the accounting system. Only cities
with an active rate can be delivered to — there is no silent default fee.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models

FREE_SHIPPING_THRESHOLD = 1000.0


def _aware(dt: datetime) -> datetime:
    # SQLite hands back naive datetimes; they're stored as UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def find_coupon(db: Session, code: str, *, lock: bool = False) -> models.Coupon | None:
    q = db.query(models.Coupon).filter(models.Coupon.code == code.strip().upper())
    if lock:
        q = q.with_for_update()  # serialises max_uses checks across checkouts
    return q.first()


def coupon_discount(coupon: models.Coupon | None, subtotal: float, *, already_applied: bool = False) -> tuple[float, str | None]:
    """(discount, reason it doesn't apply). `already_applied` is for editing
    an order that already holds this coupon: its use is already counted and
    the customer keeps it even if it has since expired or run out — only
    the minimum order amount is re-checked against the new subtotal."""
    if coupon is None or (not already_applied and not coupon.is_active):
        return 0.0, "الكوبون غير موجود أو غير مفعّل"
    if not already_applied:
        if coupon.expires_at and _aware(coupon.expires_at) < datetime.now(timezone.utc):
            return 0.0, "الكوبون منتهي الصلاحية"
        if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
            return 0.0, "الكوبون وصل للحد الأقصى من الاستخدام"
    if subtotal < coupon.min_order_amount:
        return 0.0, f"الحد الأدنى للطلب مع الكوبون ده {coupon.min_order_amount:,.0f} ج.م"
    if coupon.discount_type == models.CouponDiscountType.percentage:
        discount = subtotal * (coupon.discount_value / 100)
    else:
        discount = coupon.discount_value
    return round(min(discount, subtotal), 2), None


def city_fee(db: Session, city: str) -> float | None:
    """The configured fee for a deliverable city, or None if we don't ship there."""
    rate = (
        db.query(models.ShippingRate)
        .filter(models.ShippingRate.city == city.strip())
        .filter(models.ShippingRate.is_active == True)  # noqa: E712
        .first()
    )
    return rate.fee if rate else None


@dataclass
class Totals:
    subtotal: float
    discount: float
    coupon: models.Coupon | None
    coupon_error: str | None
    # None = no deliverable city chosen yet (and not free).
    shipping_fee: float | None
    city_error: str | None

    @property
    def total(self) -> float:
        return round(self.subtotal - self.discount + (self.shipping_fee or 0), 2)


def totals(
    db: Session,
    subtotal: float,
    *,
    city: str | None,
    coupon_code: str | None = None,
    applied_coupon: models.Coupon | None = None,
    lock_coupon: bool = False,
) -> Totals:
    """Pass `coupon_code` for a coupon the customer is entering now, or
    `applied_coupon` for the one an existing order already holds."""
    coupon, discount, coupon_error = None, 0.0, None
    if applied_coupon is not None:
        discount, coupon_error = coupon_discount(applied_coupon, subtotal, already_applied=True)
        coupon = applied_coupon if coupon_error is None else None
    elif coupon_code and coupon_code.strip():
        found = find_coupon(db, coupon_code, lock=lock_coupon)
        discount, coupon_error = coupon_discount(found, subtotal)
        coupon = found if coupon_error is None else None

    shipping_fee, city_error = None, None
    if city and city.strip():
        shipping_fee = city_fee(db, city)
        if shipping_fee is None:
            city_error = "التوصيل للمحافظة دي مش متاح حاليًا"
    if subtotal - discount >= FREE_SHIPPING_THRESHOLD:
        shipping_fee = 0.0
    return Totals(subtotal, discount, coupon, coupon_error, shipping_fee, city_error)


def require_orderable(t: Totals) -> None:
    """Order creation/editing refuses what the quote would only flag."""
    if t.coupon_error:
        raise HTTPException(400, t.coupon_error)
    if t.city_error:
        raise HTTPException(400, t.city_error)
    if t.shipping_fee is None:
        raise HTTPException(400, "اختاري المحافظة قبل تأكيد الطلب")


def release_coupon(order: models.Order) -> None:
    """Give back the coupon use an order took (cancellation, or an edit
    that no longer qualifies for it)."""
    if order.coupon is not None and order.coupon.used_count > 0:
        order.coupon.used_count -= 1
