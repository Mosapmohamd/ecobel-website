"""Checkout totals — coupon, shipping and the final amount.

The cart quote (what the customer sees) and order creation/editing (what
the order is charged) both go through `totals()`, so the storefront never
re-implements discount or shipping rules of its own.

Order of calculation: promotions' product discounts (app/promotions.py),
then the coupon on what is left, then shipping.

Shipping: free at FREE_SHIPPING_THRESHOLD (after discounts); otherwise the
fee staff configured for the city in the accounting system, unless a
free-shipping promotion waives it. Only cities with an active rate can be
delivered to — there is no silent default fee.
"""
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models, pricing, promotions

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


class CouponGuessGuard:
    """Slows down coupon-code guessing: after `limit` codes that don't exist
    (or aren't active) within `window` seconds from one client, coupon codes
    from that client aren't checked until the window passes. Real coupons
    that merely don't qualify (minimum order, expired) don't count.
    In memory per process, like the request rate limiter."""

    MESSAGE = "محاولات كتير لأكواد خصم غير صحيحة — استني شوية وحاولي تاني"

    def __init__(self, limit: int = 10, window: float = 15 * 60):
        self.limit, self.window = limit, window
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, client: str) -> deque[float]:
        q = self._failures[client]
        cutoff = time.monotonic() - self.window
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def blocked(self, client: str) -> bool:
        return len(self._recent(client)) >= self.limit

    def record_failure(self, client: str) -> None:
        self._recent(client).append(time.monotonic())


coupon_guard = CouponGuessGuard()


@dataclass
class Totals:
    subtotal: float
    discount: float  # the coupon's discount
    coupon: models.Coupon | None
    coupon_error: str | None
    # What delivery costs the customer (after any free-shipping offer);
    # None = no deliverable city chosen yet (and not free).
    shipping_fee: float | None
    city_error: str | None
    promotion_discount: float = 0.0  # product discount from promotions
    promotion_result: promotions.Result | None = None
    base_shipping_fee: float | None = None  # before free-shipping offers

    @property
    def total(self) -> float:
        return round(self.subtotal - self.promotion_discount - self.discount + (self.shipping_fee or 0), 2)

    @property
    def shipping_discount(self) -> float:
        return self.promotion_result.shipping_discount if self.promotion_result else 0.0

    def promotion_ids(self) -> set[str]:
        return {a.rule.id for a in self.promotion_result.applied} if self.promotion_result else set()


def totals(
    db: Session,
    subtotal: float,
    *,
    city: str | None,
    coupon_code: str | None = None,
    applied_coupon: models.Coupon | None = None,
    lock_coupon: bool = False,
    client: str | None = None,
    lines: list[promotions.Line] | None = None,
    bundles: list[promotions.BundleGroup] = (),
    customer_id: str | None = None,
    held_promotions: Iterable[str] = (),
    exclude_order_id: str | None = None,
    lock_promotions: bool = False,
) -> Totals:
    """Pass `coupon_code` for a coupon the customer is entering now, or
    `applied_coupon` for the one an existing order already holds. `client`
    (the caller's address) enables the coupon-guessing guard.

    `lines` (the priced, orderable loose lines) turns on promotions (app/
    promotions.py), with `bundles` (whole bundles the customer added):
    product offers first, then the coupon on what's left, then shipping. `customer_id` enables per-customer limits;
    `held_promotions` are offers an order being edited already counted.
    `lock_promotions` (checkout) re-runs everything with the applied offers'
    rows locked, so usage limits hold under concurrent checkouts."""
    coupon, coupon_error, use_applied = None, None, applied_coupon is not None
    if use_applied:
        coupon = applied_coupon
    elif coupon_code and coupon_code.strip():
        if client and coupon_guard.blocked(client):
            coupon_error = CouponGuessGuard.MESSAGE
        else:
            coupon = find_coupon(db, coupon_code, lock=lock_coupon)
            if client and (coupon is None or not coupon.is_active):
                coupon_guard.record_failure(client)
            if coupon is None:
                coupon_error = "الكوبون غير موجود أو غير مفعّل"

    base_fee, city_error = None, None
    if city and city.strip():
        base_fee = city_fee(db, city)
        if base_fee is None:
            city_error = "التوصيل للمحافظة دي مش متاح حاليًا"

    held = set(held_promotions)
    rules: list[promotions.Rule] = []
    uses = None
    if lines is not None:
        rules = promotions.load_rules(db, models, include=held)
        uses = promotions.customer_uses(db, models, customer_id, exclude_order_id=exclude_order_id)
    now = pricing.now_utc()
    locked: set[str] = set()
    while True:
        result, promo_discount = None, 0.0
        if lines is not None:
            result = promotions.evaluate_products(rules, lines, now=now, customer_uses=uses, held=held, bundles=bundles)
            promo_discount = min(result.discount, subtotal)
        discount, why = 0.0, coupon_error
        if coupon is not None and coupon_error is None:
            discount, why = coupon_discount(coupon, round(subtotal - promo_discount, 2), already_applied=use_applied)
        shipping_fee = base_fee
        if subtotal - promo_discount - discount >= FREE_SHIPPING_THRESHOLD:
            shipping_fee = 0.0
        if result is not None:
            promotions.evaluate_shipping(
                rules, lines + promotions.bundle_lines(bundles), result, now=now, city=city, shipping_fee=shipping_fee,
                subtotal_after_discounts=subtotal - promo_discount - discount, customer_uses=uses, held=held,
            )
            if shipping_fee is not None:
                shipping_fee = round(shipping_fee - result.shipping_discount, 2)
        if not lock_promotions or result is None:
            break
        need = {a.rule.id for a in result.applied} - locked
        if not need:
            break
        locked |= need  # lock them, re-read their counters, evaluate again
        rules = promotions.load_rules(db, models, include=held, lock_ids=locked)
        uses = promotions.customer_uses(db, models, customer_id, exclude_order_id=exclude_order_id)

    applied = coupon if (coupon is not None and why is None) else None
    return Totals(subtotal, discount if applied else 0.0, applied, why, shipping_fee, city_error,
                  promotion_discount=promo_discount, promotion_result=result, base_shipping_fee=base_fee)


def require_orderable(t: Totals) -> None:
    """Order creation/editing refuses what the quote would only flag."""
    bad = t.promotion_result.bundle_issues if t.promotion_result else []
    if bad:
        raise HTTPException(409, bad[0].reason or "في باقة في السلة مش متاحة بالشكل ده")
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


def _add_promotion_records(db: Session, order: models.Order, t: Totals) -> None:
    for a in t.promotion_result.applied if t.promotion_result else []:
        db.add(models.OrderPromotion(
            order_id=order.id,
            promotion_id=a.rule.id,
            customer_id=order.customer_id,
            name=a.rule.name,
            type=a.rule.type,
            terms=a.rule.terms(),  # what the customer was promised, as of now
            discount=a.discount,
            shipping_discount=a.shipping_discount,
            details={**a.snapshot(), "order_subtotal": t.subtotal, "order_total": t.total},
        ))


def record_promotions(db: Session, order: models.Order, t: Totals) -> None:
    """Store what a new order received from each offer and count one use of
    each. Call with the totals checkout charged."""
    _add_promotion_records(db, order, t)
    promotions.count_use(db, models, t.promotion_ids(), +1)


def order_promotion_ids(db: Session, order: models.Order) -> set[str]:
    rows = db.query(models.OrderPromotion.promotion_id).filter(models.OrderPromotion.order_id == order.id).all()
    return {r[0] for r in rows}


def release_promotions(db: Session, order: models.Order) -> None:
    """Give back the offer uses an order took (cancellation). The order's
    order_promotions rows stay as its history; a cancelled order no longer
    counts toward per-customer limits."""
    promotions.count_use(db, models, order_promotion_ids(db, order), -1)


def replace_promotions(db: Session, order: models.Order, t: Totals) -> None:
    """After an order edit: release offers it no longer gets, count new ones,
    and replace its per-order records with the re-priced ones."""
    before, after = order_promotion_ids(db, order), t.promotion_ids()
    promotions.count_use(db, models, before - after, -1)
    db.query(models.OrderPromotion).filter(models.OrderPromotion.order_id == order.id).delete(synchronize_session=False)
    _add_promotion_records(db, order, t)
    promotions.count_use(db, models, after - before, +1)
