from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(category_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Public storefront listing — only active products with stock > 0 are shown."""
    q = (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.quantity > 0)
    )
    if category_id:
        q = q.filter(models.Product.category_id == category_id)
    return q.order_by(models.Product.name).all()


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
