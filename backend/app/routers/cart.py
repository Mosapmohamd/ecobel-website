from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import auth, checkout, models, pricing, promotions, schemas
from ..database import get_db
from ..rate_limit import limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/cart", tags=["Cart"])


def _promotion_hints(t: checkout.Totals, lines: list[promotions.Line]) -> list[schemas.PromotionHint]:
    """Offers related to this cart that it doesn't get — with the reason.
    Offers that aren't running (or are used up) are never mentioned."""
    if not t.promotion_result:
        return []
    applied = t.promotion_ids()
    seen, out = set(), []
    for s in t.promotion_result.skipped:
        r = s.rule
        if s.kind == "unavailable" or r.id in applied or r.id in seen or not promotions.touches_cart(r, lines):
            continue
        seen.add(r.id)
        out.append(schemas.PromotionHint(
            id=r.id, name=r.name, type=r.type, badge_text=r.badge_text, summary=promotions.describe(r), reason=s.reason,
        ))
    return out


@router.post("/quote", response_model=schemas.CartQuote)
@limiter.limit("60/minute")
def quote_cart(
    request: Request,
    payload: schemas.CartQuoteRequest,
    db: Session = Depends(get_db),
    customer: models.Customer | None = Depends(auth.get_current_customer_optional),
):
    """Prices a browser cart (loose product lines plus whole bundles) — and
    the coupon and delivery city when given — with the same rules checkout
    uses, promotions included. The storefront shows these numbers instead
    of computing its own, so the total on screen is the total the order is
    charged (checkout recomputes everything from the database again)."""
    lines, bundle_views, promo_lines, groups = pricing.quote_cart(db, payload.items, payload.bundles)
    orderable = [line for line in lines if line.issue is None]
    valid_groups = [g for g in groups if g is not None]
    bundle_units = promotions.bundle_lines(valid_groups)
    subtotal = round(sum(line.line_total for line in orderable) + sum(l.unit_price * l.quantity for l in bundle_units), 2)
    regular_subtotal = round(
        sum(line.regular_unit_price * line.quantity for line in orderable)
        + sum(i.product.sale_price * i.quantity * v.quantity for v, g in zip(bundle_views, groups) if g is not None for i in v.items),
        2,
    )
    t = checkout.totals(
        db, subtotal, city=payload.city, coupon_code=payload.coupon_code, client=get_remote_address(request),
        lines=promo_lines, bundles=valid_groups, customer_id=customer.id if customer else None,
    )
    result = t.promotion_result
    if result:
        # Loose lines show only the offers on loose units; a bundle's saving
        # is shown on the bundle.
        allocations: dict[str, float] = {}
        free: dict[str, int] = {}
        for a in result.applied:
            if a.rule.type == "bundle":
                continue
            for pid, d in a.allocations.items():
                allocations[pid] = round(allocations.get(pid, 0) + d, 2)
            for pid, n in a.free_units.items():
                free[pid] = free.get(pid, 0) + n
        for line in orderable:
            line.promotion_discount = allocations.get(line.product_id, 0)
            line.free_units = free.get(line.product_id, 0)
        outcomes = iter(result.bundles)
        for view, group in zip(bundle_views, groups):
            if group is None:
                continue
            o = next(outcomes)
            view.issue = view.issue or (None if o.ok else o.reason)
            if o.ok:
                view.total, view.discount = o.price, o.discount
            else:
                view.total = view.regular_total
    rules = {r.id: r for r in pricing.live_promotions(db)} if bundle_views else {}
    for view in bundle_views:
        r = rules.get(view.promotion_id)
        if r is not None:
            view.name, view.badge_text, view.summary, view.fixed = r.name, r.badge_text, promotions.describe(r), r.fixed_bundle
        elif view.issue is None:
            view.issue = "عرض الباقة ده مش متاح دلوقتي — شيليها من السلة"
    code = (payload.coupon_code or "").strip()
    savings = round(regular_subtotal - subtotal, 2)
    return schemas.CartQuote(
        lines=lines,
        subtotal=subtotal,
        regular_subtotal=regular_subtotal,
        savings=savings,
        has_issues=any(line.issue for line in lines) or any(v.issue for v in bundle_views),
        coupon=schemas.CouponStatus(code=code.upper(), valid=t.coupon is not None, reason=t.coupon_error) if code else None,
        discount=t.discount,
        shipping_fee=t.shipping_fee,
        city_error=t.city_error,
        free_shipping_threshold=checkout.FREE_SHIPPING_THRESHOLD,
        total=t.total,
        promotion_discount=t.promotion_discount,
        shipping_discount=t.shipping_discount,
        promotions=[
            schemas.AppliedPromotion(
                id=a.rule.id, name=a.rule.name, type=a.rule.type, badge_text=a.rule.badge_text,
                summary=promotions.describe(a.rule), discount=a.discount, shipping_discount=a.shipping_discount,
                detail=a.detail,
            )
            for a in (result.applied if result else [])
        ],
        promotion_hints=_promotion_hints(t, promo_lines + bundle_units),
        bundles=bundle_views,
        total_savings=round(savings + t.promotion_discount + t.discount + t.shipping_discount, 2),
    )
