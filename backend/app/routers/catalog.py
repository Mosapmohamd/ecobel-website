from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, pricing
from ..database import get_db

router = APIRouter(prefix="/catalog", tags=["Catalog"])

ProductSort = Literal["newest", "price_asc", "price_desc", "name"]


def _sellable_products(db: Session):
    """Active products with stock — the only ones the storefront lists."""
    return (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.quantity > 0)
    )


def _load_routines(db: Session):
    return db.query(models.Routine).options(
        joinedload(models.Routine.items).joinedload(models.RoutineItem.product).joinedload(models.Product.category)
    )


@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """Categories with the number of products the storefront actually lists
    under them (active and in stock), so a count never promises more than
    the category page shows."""
    rows = (
        db.query(models.Category, func.count(models.Product.id))
        .outerjoin(
            models.Product,
            (models.Product.category_id == models.Category.id)
            & (models.Product.is_active == True)  # noqa: E712
            & (models.Product.quantity > 0),
        )
        .group_by(models.Category.id)
        .order_by(models.Category.name)
        .all()
    )
    return [schemas.CategoryOut(id=cat.id, name=cat.name, product_count=count) for cat, count in rows]


@router.get("/products", response_model=schemas.ProductPage)
def list_products(
    category_id: Optional[str] = None,
    q: Optional[str] = Query(None, max_length=100, description="Search name, description, category and SKU"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    on_offer: bool = False,
    sort: ProductSort = "newest",
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """The full sellable catalog. Price filters and price sorting use the
    price checkout charges (offers included). Featured placement never
    affects this listing."""
    offer_sq = pricing.offer_price_subquery()
    price = pricing.effective_price_expr(offer_sq)
    query = (
        _sellable_products(db)
        .join(models.Category, models.Category.id == models.Product.category_id)
        .outerjoin(offer_sq, offer_sq.c.product_id == models.Product.id)
        .options(joinedload(models.Product.category))
    )
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            models.Product.name.ilike(term),
            models.Product.description.ilike(term),
            models.Product.sku.ilike(term),
            models.Category.name.ilike(term),
        ))
    if min_price is not None:
        query = query.filter(price >= min_price)
    if max_price is not None:
        query = query.filter(price <= max_price)
    if on_offer:
        query = query.filter(price < models.Product.sale_price)

    total = query.count()
    order = {
        "newest": [models.Product.created_at.desc(), models.Product.name],
        "price_asc": [price.asc(), models.Product.name],
        "price_desc": [price.desc(), models.Product.name],
        "name": [models.Product.name],
    }[sort]
    products = query.order_by(*order, models.Product.id).offset(offset).limit(limit).all()
    return schemas.ProductPage(items=pricing.products_out(db, products), total=total, limit=limit, offset=offset)


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    """Product page — also returns active out-of-stock products (shown as
    unavailable), but never deactivated ones."""
    product = (
        db.query(models.Product)
        .options(joinedload(models.Product.category))
        .filter(models.Product.id == product_id)
        .filter(models.Product.is_active == True)  # noqa: E712
        .first()
    )
    if not product:
        raise HTTPException(404, "المنتج غير موجود")
    return pricing.products_out(db, [product])[0]


@router.get("/products/{product_id}/related", response_model=List[schemas.ProductOut])
def related_products(product_id: str, limit: int = Query(4, ge=1, le=12), db: Session = Depends(get_db)):
    """Other sellable products from the same category (newest first) — never
    the product itself, never padded with unrelated products."""
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "المنتج غير موجود")
    related = (
        _sellable_products(db)
        .options(joinedload(models.Product.category))
        .filter(models.Product.category_id == product.category_id)
        .filter(models.Product.id != product.id)
        .order_by(models.Product.created_at.desc(), models.Product.name)
        .limit(limit)
        .all()
    )
    return pricing.products_out(db, related)


@router.get("/featured-products", response_model=List[schemas.ProductOut])
def featured_products(db: Session = Depends(get_db)):
    """Homepage "منتجات مختارة" — exactly the slots staff set in the
    accounting system, in their order. A slot whose product is no longer
    sellable is skipped (never replaced by another product)."""
    rows = (
        db.query(models.FeaturedProduct)
        .options(joinedload(models.FeaturedProduct.product).joinedload(models.Product.category))
        .order_by(models.FeaturedProduct.position)
        .limit(models.FEATURED_PRODUCTS_MAX)
        .all()
    )
    products = [r.product for r in rows if pricing.is_available(r.product)]
    return pricing.products_out(db, products)


@router.get("/routines", response_model=List[schemas.RoutineOut])
def list_routines(
    q: Optional[str] = Query(None, max_length=100, description="Search routine name and description"),
    db: Session = Depends(get_db),
):
    """All active routines — the "الروتين" catalog category. Routines with
    an unavailable product are still listed, flagged `is_available: false`.
    With `q`, only routines whose name or description matches (the catalog
    search shows these next to matching products)."""
    query = _load_routines(db).filter(models.Routine.is_active == True)  # noqa: E712
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(models.Routine.name.ilike(term), models.Routine.description.ilike(term)))
    routines = query.order_by(models.Routine.created_at.desc(), models.Routine.name).all()
    return pricing.routines_out(db, routines)


@router.get("/routines/{routine_id}", response_model=schemas.RoutineOut)
def get_routine(routine_id: str, db: Session = Depends(get_db)):
    routine = (
        _load_routines(db)
        .filter(models.Routine.id == routine_id)
        .filter(models.Routine.is_active == True)  # noqa: E712
        .first()
    )
    if not routine:
        raise HTTPException(404, "الروتين غير موجود")
    return pricing.routines_out(db, [routine])[0]


@router.get("/featured-routines", response_model=List[schemas.RoutineOut])
def featured_routines(db: Session = Depends(get_db)):
    """Homepage routines — the slots staff set, in order; a slot whose
    routine is inactive or has an unavailable product is skipped."""
    rows = (
        db.query(models.FeaturedRoutine)
        .options(
            joinedload(models.FeaturedRoutine.routine)
            .joinedload(models.Routine.items)
            .joinedload(models.RoutineItem.product)
            .joinedload(models.Product.category)
        )
        .order_by(models.FeaturedRoutine.position)
        .limit(models.FEATURED_ROUTINES_MAX)
        .all()
    )
    routines = pricing.routines_out(db, [r.routine for r in rows if r.routine.is_active])
    return [r for r in routines if r.is_available]


@router.get("/shipping-rates", response_model=List[schemas.ShippingRateOut])
def list_shipping_rates(db: Session = Depends(get_db)):
    """Active cities and their delivery fee, for the checkout page's city
    selector. Managed by staff in the accounting system."""
    return (
        db.query(models.ShippingRate)
        .filter(models.ShippingRate.is_active == True)  # noqa: E712
        .order_by(models.ShippingRate.city)
        .all()
    )
