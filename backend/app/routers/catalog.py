from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(
    category_id: Optional[str] = None,
    q: Optional[str] = Query(None, description="Free-text search on product name"),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Public storefront listing — only active products with stock > 0 are shown."""
    query = (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.quantity > 0)
    )
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if q:
        query = query.filter(models.Product.name.ilike(f"%{q.strip()}%"))
    return query.order_by(models.Product.name).limit(limit).all()


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = (
        db.query(models.Product)
        .filter(models.Product.id == product_id)
        .filter(models.Product.is_active == True)  # noqa: E712
        .first()
    )
    if not product:
        raise HTTPException(404, "المنتج غير موجود")
    return product


@router.get("/offers", response_model=List[schemas.OfferOut])
def list_offers(db: Session = Depends(get_db)):
    """Homepage offers — active, not expired, and the underlying product
    is still active with stock. Kept separate from /products on purpose:
    offers are merchandising, not a category filter."""
    now = datetime.now(timezone.utc)
    offers = (
        db.query(models.Offer)
        .join(models.Product, models.Product.id == models.Offer.product_id)
        .filter(models.Offer.is_active == True)  # noqa: E712
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.quantity > 0)
        .filter((models.Offer.expires_at.is_(None)) | (models.Offer.expires_at > now))
        .order_by(models.Offer.created_at.desc())
        .all()
    )
    return offers


@router.get("/routines", response_model=List[schemas.RoutineOut])
def list_routines(db: Session = Depends(get_db)):
    """Homepage routines — curated 2-3 product bundles of the same kind."""
    return (
        db.query(models.Routine)
        .options(joinedload(models.Routine.items).joinedload(models.RoutineItem.product))
        .filter(models.Routine.is_active == True)  # noqa: E712
        .order_by(models.Routine.created_at.desc())
        .all()
    )
