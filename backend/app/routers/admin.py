import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(auth.get_current_staff)])

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------- Categories ----------------
@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.post("/categories", response_model=schemas.CategoryOut, status_code=201)
def create_category(payload: schemas.CategoryCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "اسم الفئة مطلوب")
    if db.query(models.Category).filter(models.Category.name == name).first():
        raise HTTPException(400, "فئة بنفس الاسم موجودة بالفعل")
    category = models.Category(name=name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=schemas.CategoryOut)
def update_category(category_id: str, payload: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(models.Category, category_id)
    if not category:
        raise HTTPException(404, "الفئة غير موجودة")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "اسم الفئة مطلوب")
    duplicate = db.query(models.Category).filter(models.Category.name == name, models.Category.id != category_id).first()
    if duplicate:
        raise HTTPException(400, "فئة بنفس الاسم موجودة بالفعل")
    category.name = name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db)):
    category = db.get(models.Category, category_id)
    if not category:
        raise HTTPException(404, "الفئة غير موجودة")
    in_use = db.query(models.Product).filter(models.Product.category_id == category_id).first()
    if in_use:
        raise HTTPException(400, "مينفعش تمسحي فئة فيها منتجات — انقلي المنتجات لفئة تانية الأول")
    db.delete(category)
    db.commit()


# ---------------- Products ----------------
@router.get("/products", response_model=List[schemas.ProductOut])
def list_all_products(db: Session = Depends(get_db)):
    """Unlike the public /catalog/products, this shows everything —
    inactive and out-of-stock products included — so staff can manage them."""
    return db.query(models.Product).order_by(models.Product.name).all()


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductAdminCreate, db: Session = Depends(get_db)):
    if not db.get(models.Category, payload.category_id):
        raise HTTPException(404, "الفئة غير موجودة")
    if payload.sku and db.query(models.Product).filter(models.Product.sku == payload.sku).first():
        raise HTTPException(400, "SKU مستخدم بالفعل لمنتج آخر")
    duplicate = (
        db.query(models.Product)
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.category_id == payload.category_id)
        .filter(func.lower(func.trim(models.Product.name)) == payload.name.strip().lower())
        .first()
    )
    if duplicate:
        raise HTTPException(400, "منتج بنفس الاسم موجود بالفعل في نفس الفئة")

    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: str, payload: schemas.ProductAdminUpdate, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "المنتج غير موجود")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] and not db.get(models.Category, data["category_id"]):
        raise HTTPException(404, "الفئة غير موجودة")

    new_name = data.get("name", product.name)
    new_category_id = data.get("category_id", product.category_id)
    duplicate = (
        db.query(models.Product)
        .filter(models.Product.id != product.id)
        .filter(models.Product.is_active == True)  # noqa: E712
        .filter(models.Product.category_id == new_category_id)
        .filter(func.lower(func.trim(models.Product.name)) == new_name.strip().lower())
        .first()
    )
    if duplicate:
        raise HTTPException(400, "منتج بنفس الاسم موجود بالفعل في نفس الفئة")

    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    """Soft-delete — same reasoning as the accounting system: past order
    items and movements still reference this row."""
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "المنتج غير موجود")
    product.is_active = False
    db.commit()


@router.post("/products/{product_id}/image", response_model=schemas.ProductOut)
async def upload_product_image(product_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "المنتج غير موجود")

    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(400, "الصورة لازم تكون JPG أو PNG أو WEBP")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "حجم الصورة أكبر من 5 ميجا")

    products_dir = os.path.join(STATIC_DIR, "products")
    os.makedirs(products_dir, exist_ok=True)
    filename = f"{product.id}-{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(products_dir, filename), "wb") as f:
        f.write(contents)

    product.image_url = f"/static/products/{filename}"
    db.commit()
    db.refresh(product)
    return product


# ---------------- Sales analytics ----------------
@router.get("/analytics", response_model=schemas.SalesAnalytics)
def sales_analytics(db: Session = Depends(get_db)):
    orders = db.query(models.Order).filter(models.Order.status != models.OrderStatus.cancelled).all()
    total_revenue = sum(o.total_amount for o in orders)
    total_orders = len(orders)

    status_counts: dict[str, int] = defaultdict(int)
    for o in db.query(models.Order).all():
        status_counts[o.status.value] += 1

    since = datetime.now(timezone.utc) - timedelta(days=30)
    since_naive = since.replace(tzinfo=None)
    daily = defaultdict(float)
    for o in orders:
        if not o.created_at:
            continue
        # SQLite doesn't reliably round-trip tzinfo, so compare naive-to-naive.
        created = o.created_at.replace(tzinfo=None) if o.created_at.tzinfo else o.created_at
        if created >= since_naive:
            day = created.strftime("%Y-%m-%d")
            daily[day] += o.total_amount
    revenue_points = [
        schemas.RevenuePoint(date=(since + timedelta(days=i)).strftime("%Y-%m-%d"), total=daily.get((since + timedelta(days=i)).strftime("%Y-%m-%d"), 0.0))
        for i in range(31)
    ]

    item_stats: dict[str, dict] = defaultdict(lambda: {"quantity": 0, "revenue": 0.0})
    items = (
        db.query(models.OrderItem)
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .filter(models.Order.status != models.OrderStatus.cancelled)
        .all()
    )
    for it in items:
        item_stats[it.product_name]["quantity"] += it.quantity
        item_stats[it.product_name]["revenue"] += it.line_total
    top_products = sorted(
        (schemas.TopProduct(product_name=name, quantity_sold=s["quantity"], revenue=s["revenue"]) for name, s in item_stats.items()),
        key=lambda p: p.quantity_sold,
        reverse=True,
    )[:5]

    return schemas.SalesAnalytics(
        total_revenue=total_revenue,
        total_orders=total_orders,
        orders_by_status=dict(status_counts),
        revenue_last_30_days=revenue_points,
        top_products=top_products,
    )
