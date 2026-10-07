"""The one place that decides what a product costs right now.

Catalog listings, product pages, routines, the cart quote and checkout all
price through these functions, so the price a customer sees is the price
the order is charged — never re-implemented in the frontend.

Rule: a product's price is its `sale_price`, unless it has an active,
unexpired offer priced below `sale_price` — then the lowest such offer
price wins (deterministic even if staff left two offers active).
"""
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from . import models, schemas

# Per-line cap at checkout (mirrors schemas.OrderItemIn) — also the most
# the storefront ever says is orderable, so exact stock isn't exposed.
MAX_LINE_QUANTITY = 100


def offer_price_subquery(now: datetime | None = None):
    """product_id → lowest live offer price, as a subquery usable in joins."""
    now = now or datetime.now(timezone.utc)
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


def live_offers(db: Session, product_ids: Iterable[str]) -> dict[str, models.Offer]:
    """product_id → the offer that currently sets its price (only products
    whose offer actually undercuts sale_price are included)."""
    ids = list(set(product_ids))
    if not ids:
        return {}
    now = datetime.now(timezone.utc)
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


def unit_price(product: models.Product, offer: models.Offer | None) -> float:
    return offer.offer_price if offer else product.sale_price


def is_available(product: models.Product) -> bool:
    return bool(product.is_active) and product.quantity > 0


def product_out(product: models.Product, offer: models.Offer | None) -> schemas.ProductOut:
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
        description=product.description,
    )


def products_out(db: Session, products: list[models.Product]) -> list[schemas.ProductOut]:
    offers = live_offers(db, (p.id for p in products))
    return [product_out(p, offers.get(p.id)) for p in products]


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


def quote_lines(db: Session, lines: list[schemas.CartLineIn]) -> list[schemas.CartQuoteLine]:
    """Prices cart lines exactly as checkout will. Lines that can't be
    ordered as-is come back flagged (never silently dropped or adjusted)."""
    merged = merge_lines(lines)
    products = {p.id: p for p in db.query(models.Product).filter(models.Product.id.in_(list(merged))).all()}
    offers = live_offers(db, products.keys())

    out: list[schemas.CartQuoteLine] = []
    for pid, qty in merged.items():
        p = products.get(pid)
        if p is None or not p.is_active:
            out.append(schemas.CartQuoteLine(product_id=pid, quantity=qty, issue="unavailable"))
            continue
        offer = offers.get(pid)
        price = unit_price(p, offer)
        item = product_out(p, offer)
        issue = None
        if p.quantity <= 0:
            issue = "out_of_stock"
        elif qty > item.max_quantity:
            issue = "insufficient_stock"
        out.append(schemas.CartQuoteLine(
            product_id=pid,
            quantity=qty,
            product=item,
            unit_price=price,
            regular_unit_price=p.sale_price,
            line_total=price * qty,
            issue=issue,
        ))
    return out
