"""The one place that decides what a product costs right now.

Catalog listings, product pages, routines, the cart quote and checkout all
price through these functions, so the price a customer sees is the price
the order is charged — never re-implemented in the frontend.

Rule: a product's price is its `sale_price`, unless it has an active,
unexpired offer priced below `sale_price` — then the lowest such offer
price wins (deterministic even if staff left two offers active).

"Unexpired" means now < expires_at. expires_at is the exclusive end
instant written by ecobel-accounting-system: an admin-picked last day is
stored as the moment the next Africa/Cairo day starts (its
app/cairo_time.py), so the offer runs through that whole Cairo day.
"""
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from . import models, promotions, schemas

# Per-line cap at checkout (mirrors schemas.OrderItemIn) — also the most
# the storefront ever says is orderable, so exact stock isn't exposed.
MAX_LINE_QUANTITY = 100


def now_utc() -> datetime:
    """The clock offers are checked against (replaceable in tests)."""
    return datetime.now(timezone.utc)


def offer_price_subquery(now: datetime | None = None):
    """product_id → lowest live offer price, as a subquery usable in joins."""
    now = now or now_utc()
    return (
        select(models.Offer.product_id, func.min(models.Offer.offer_price).label("offer_price"))
        .where(models.Offer.is_active == True)  # noqa: E712
        .where(or_(models.Offer.expires_at.is_(None), models.Offer.expires_at > now))
        .group_by(models.Offer.product_id)
        .subquery()
    )


def effective_price_expr(offer_sq):
    """SQL expression for the charged price, for filtering/sorting in SQL."""
    return case(
        (and_(offer_sq.c.offer_price.isnot(None), offer_sq.c.offer_price < models.Product.sale_price), offer_sq.c.offer_price),
        else_=models.Product.sale_price,
    )


def live_offers(db: Session, product_ids: Iterable[str], now: datetime | None = None) -> dict[str, models.Offer]:
    """product_id → the offer that currently sets its price (only products
    whose offer actually undercuts sale_price are included)."""
    ids = list(set(product_ids))
    if not ids:
        return {}
    now = now or now_utc()
    offers = (
        db.query(models.Offer)
        .join(models.Product, models.Product.id == models.Offer.product_id)
        .filter(models.Offer.product_id.in_(ids))
        .filter(models.Offer.is_active == True)  # noqa: E712
        .filter(or_(models.Offer.expires_at.is_(None), models.Offer.expires_at > now))
        .filter(models.Offer.offer_price < models.Product.sale_price)
        .order_by(models.Offer.offer_price, models.Offer.created_at)
        .all()
    )
    best: dict[str, models.Offer] = {}
    for o in offers:
        best.setdefault(o.product_id, o)
    return best


def live_promotions(db: Session, now: datetime | None = None) -> list[promotions.Rule]:
    """Cart offers running now (active, in their dates, not used up)."""
    now = now or now_utc()
    return [r for r in promotions.load_rules(db, models) if promotions.is_live(r, now)]


def promotion_badge(rule: promotions.Rule, role: str = "eligible") -> schemas.PromotionBadge:
    return schemas.PromotionBadge(
        id=rule.id, name=rule.name, type=rule.type, badge_text=rule.badge_text,
        summary=promotions.describe(rule), description=rule.description, role=role,
    )


def product_promotions(product: models.Product, rules: Iterable[promotions.Rule]) -> list[schemas.PromotionBadge]:
    """Badges for the offers a product is named in. Offers open to every
    product aren't badged on each one — the cart and the offers list show them."""
    out = []
    for r in promotions.order_rules(rules):
        if r.restricted and r.matches(product.id, product.category_id):
            out.append(promotion_badge(r))
        elif r.type == "buy_x_get_y" and r.has_reward_targets and r.matches(product.id, product.category_id, "reward"):
            out.append(promotion_badge(r, "reward"))
    return out


def unit_price(product: models.Product, offer: models.Offer | None) -> float:
    return offer.offer_price if offer else product.sale_price


def is_available(product: models.Product) -> bool:
    return bool(product.is_active) and product.quantity > 0


def product_out(product: models.Product, offer: models.Offer | None, rules: Iterable[promotions.Rule] = ()) -> schemas.ProductOut:
    return schemas.ProductOut(
        id=product.id,
        name=product.name,
        category_id=product.category_id,
        category_name=product.category_name,
        sku=product.sku,
        sale_price=product.sale_price,
        price=unit_price(product, offer),
        offer=schemas.OfferBrief(id=offer.id, title=offer.title, offer_price=offer.offer_price) if offer else None,
        stock_status=product.stock_status if product.is_active else "out",
        max_quantity=min(product.quantity, MAX_LINE_QUANTITY) if is_available(product) else 0,
        image_url=product.image_url,
        short_description=product.short_description,
        description=product.description,
        promotions=product_promotions(product, rules),
    )


def products_out(db: Session, products: list[models.Product]) -> list[schemas.ProductOut]:
    offers = live_offers(db, (p.id for p in products))
    rules = live_promotions(db) if products else []
    return [product_out(p, offers.get(p.id), rules) for p in products]


def routine_out(routine: models.Routine, offers: dict[str, models.Offer]) -> schemas.RoutineOut:
    items = []
    for it in routine.items:
        p = it.product
        offer = offers.get(p.id)
        items.append(schemas.RoutineItemOut(
            product=product_out(p, offer),
            regular_price=p.sale_price,
            price=unit_price(p, offer),
        ))
    regular_total = sum(i.regular_price for i in items)
    total = sum(i.price for i in items)
    return schemas.RoutineOut(
        id=routine.id,
        name=routine.name,
        description=routine.description,
        items=items,
        regular_total=regular_total,
        total=total,
        savings=round(regular_total - total, 2),
        is_available=bool(items) and all(i.product.max_quantity > 0 for i in items),
    )


def routines_out(db: Session, routines: list[models.Routine]) -> list[schemas.RoutineOut]:
    offers = live_offers(db, (it.product_id for r in routines for it in r.items))
    return [routine_out(r, offers) for r in routines]


def merge_lines(lines) -> dict[str, int]:
    """product_id -> total quantity, so stock is checked against the sum
    when the same product appears on several lines."""
    merged: dict[str, int] = {}
    for line in lines:
        merged[line.product_id] = merged.get(line.product_id, 0) + line.quantity
    return merged


def bundle_demand(bundles) -> dict[str, int]:
    """product_id -> units the cart's bundles need."""
    out: dict[str, int] = {}
    for b in bundles:
        for it in b.items:
            out[it.product_id] = out.get(it.product_id, 0) + it.quantity * b.quantity
    return out


BUNDLE_ITEM_ISSUE = {
    "unavailable": "منتج في الباقة مش متاح دلوقتي — شيلي الباقة من السلة",
    "out_of_stock": "«{name}» خلص من المخزن، فالباقة مش متاحة دلوقتي",
    "insufficient_stock": "الكمية المطلوبة من «{name}» مش متاحة — قللي عدد الباقات",
}


def quote_cart(db: Session, lines: list[schemas.CartLineIn], bundles: list[schemas.BundleIn] = ()):
    """Prices a cart exactly as checkout will: loose lines plus whole bundles.
    Stock is checked against everything the cart needs of a product (its own
    line plus what bundles hold). Anything that can't be ordered as-is comes
    back flagged — never silently dropped or adjusted.

    Returns (lines, bundle views, engine lines for the orderable loose lines,
    engine BundleGroup per bundle — None when one of its products can't be
    sold in that quantity)."""
    merged = merge_lines(lines)
    demand = dict(merged)
    for pid, n in bundle_demand(bundles).items():
        demand[pid] = demand.get(pid, 0) + n
    products = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(list(demand))).all()} if demand else {}
    offers = live_offers(db, products.keys())
    rules = live_promotions(db) if products else []

    def issue_of(pid: str):
        p = products.get(pid)
        if p is None or not p.is_active:
            return "unavailable"
        if p.quantity <= 0:
            return "out_of_stock"
        if demand[pid] > min(p.quantity, MAX_LINE_QUANTITY):
            return "insufficient_stock"
        return None

    out: list[schemas.CartQuoteLine] = []
    promo_lines: list[promotions.Line] = []
    for pid, qty in merged.items():
        p = products.get(pid)
        issue = issue_of(pid)
        if p is None or not p.is_active:
            out.append(schemas.CartQuoteLine(product_id=pid, quantity=qty, issue="unavailable"))
            continue
        offer = offers.get(pid)
        price = unit_price(p, offer)
        out.append(schemas.CartQuoteLine(
            product_id=pid, quantity=qty, product=product_out(p, offer, rules), unit_price=price,
            regular_unit_price=p.sale_price, line_total=price * qty, issue=issue,
        ))
        if issue is None:
            promo_lines.append(promotions.Line(pid, p.category_id, price, qty))

    views: list[schemas.CartBundle] = []
    groups: list = []
    for b in bundles:
        items, problem, engine_items = [], None, []
        for it in b.items:
            p = products.get(it.product_id)
            issue = issue_of(it.product_id)
            if issue and problem is None:
                problem = BUNDLE_ITEM_ISSUE[issue].format(name=p.name if p else "")
            if p is None or not p.is_active:
                items.append(schemas.CartBundleItem(product_id=it.product_id, quantity=it.quantity))
                continue
            offer = offers.get(p.id)
            price = unit_price(p, offer)
            items.append(schemas.CartBundleItem(product_id=p.id, quantity=it.quantity, product=product_out(p, offer, rules), unit_price=price))
            engine_items.append(promotions.Line(p.id, p.category_id, price, it.quantity))
        views.append(schemas.CartBundle(promotion_id=b.promotion_id, quantity=b.quantity, items=items, issue=problem,
                                        regular_total=round(sum(i.unit_price * i.quantity for i in items) * b.quantity, 2)))
        groups.append(None if problem else promotions.BundleGroup(b.promotion_id, engine_items, b.quantity))
    return out, views, promo_lines, groups


def bundle_offer(db: Session, rule: promotions.Rule) -> schemas.BundleOffer:
    """A live bundle offer with its products, for the offer card."""
    if rule.fixed_bundle:
        wanted = rule.bundle_contents()
        q = db.query(models.Product).filter(models.Product.id.in_(list(wanted)))
    else:
        wanted = {}
        q = db.query(models.Product).filter(models.Product.is_active == True)  # noqa: E712
        if rule.restricted:
            q = q.filter(or_(models.Product.id.in_(list(rule.eligible_products)),
                             models.Product.category_id.in_(list(rule.eligible_categories))))
        q = q.order_by(models.Product.name).limit(100)
    found = q.all()
    offers = live_offers(db, (p.id for p in found))
    rules = [rule]
    if rule.fixed_bundle:
        by_id = {p.id: p for p in found}
        items = [schemas.BundleProductOut(product=product_out(by_id[pid], offers.get(pid), rules), quantity=n)
                 for pid, n in wanted.items() if pid in by_id]
        complete = len(items) == len(wanted)
        regular = round(sum(i.product.price * i.quantity for i in items), 2)
        available = complete and all(i.product.max_quantity >= i.quantity for i in items)
    else:
        items = [schemas.BundleProductOut(product=product_out(p, offers.get(p.id), rules)) for p in found]
        regular = None
        available = sum(min(i.product.max_quantity, 1 if rule.config.get("distinct_products") else i.product.max_quantity)
                        for i in items) >= int(rule.config["bundle_quantity"])
    price = float(rule.config["bundle_price"])
    limit = promotions.bundle_limit(rule)
    return schemas.BundleOffer(
        **promotion_badge(rule).model_dump(),
        ends_at=rule.ends_at,
        product_ids=sorted(rule.eligible_products), category_ids=sorted(rule.eligible_categories),
        fixed=rule.fixed_bundle, bundle_price=price,
        bundle_quantity=sum(wanted.values()) if rule.fixed_bundle else int(rule.config["bundle_quantity"]),
        distinct_products=bool(rule.config.get("distinct_products")), max_bundles=limit,
        products=items, regular_total=regular,
        savings=round(regular - price, 2) if regular is not None and regular > price else (0.0 if regular is not None else None),
        available=available,
    )
