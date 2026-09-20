import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth, services
from ..database import get_db
from .coupons import _validate_coupon

router = APIRouter(prefix="/orders", tags=["Orders"])

# Flat shipping fee, waived at/above this subtotal — matches the current
# site's "free shipping over 1000 EGP" policy. Adjust here if it changes.
SHIPPING_FEE = 50.0
FREE_SHIPPING_THRESHOLD = 1000.0


def _generate_order_number(db: Session) -> str:
    for _ in range(10):
        suffix = "".join(random.choices(string.digits, k=6))
        candidate = f"EB{suffix}"
        if not db.query(models.Order).filter(models.Order.order_number == candidate).first():
            return candidate
    raise HTTPException(500, "تعذر توليد رقم طلب فريد، حاول تاني")


@router.post("/", response_model=schemas.OrderOut, status_code=201)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(400, "الطلب لازم يحتوي على منتج واحد على الأقل")

    # Price everything from the current DB state — never trust client-sent prices/totals.
    subtotal = 0.0
    line_specs = []
    for item_in in payload.items:
        product = (
            db.query(models.Product)
            .filter(models.Product.id == item_in.product_id)
            .filter(models.Product.is_active == True)  # noqa: E712
            .first()
        )
        if not product:
            raise HTTPException(404, f"منتج غير موجود: {item_in.product_id}")
        line_total = product.sale_price * item_in.quantity
        subtotal += line_total
        line_specs.append((product, item_in.quantity, line_total))

    discount_amount = 0.0
    coupon = None
    if payload.coupon_code:
        coupon, reason, discount_amount = _validate_coupon(db, payload.coupon_code, subtotal)
        if not coupon:
            raise HTTPException(400, reason)

    shipping_fee = 0.0 if (subtotal - discount_amount) >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
    total_amount = subtotal - discount_amount + shipping_fee

    # Find-or-create a lightweight customer record keyed by phone.
    customer = db.query(models.Customer).filter(models.Customer.phone == payload.customer_phone).first()
    if not customer:
        customer = models.Customer(name=payload.customer_name, phone=payload.customer_phone)
        db.add(customer)
        db.flush()

    order = models.Order(
        order_number=_generate_order_number(db),
        customer_id=customer.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        shipping_address=payload.shipping_address,
        subtotal=subtotal,
        coupon_id=coupon.id if coupon else None,
        discount_amount=discount_amount,
        shipping_fee=shipping_fee,
        total_amount=total_amount,
        note=payload.note,
    )
    db.add(order)
    db.flush()

    for product, qty, line_total in line_specs:
        db.add(models.OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=product.sale_price,
            quantity=qty,
            line_total=line_total,
        ))
        services.apply_stock_movement(
            db, product, -qty, models.MovementType.website_sale,
            reference_id=order.id, note=f"طلب موقع #{order.order_number}",
        )

    if coupon:
        coupon.used_count += 1

    db.add(models.FinanceEntry(
        type=models.FinanceEntryType.income,
        category="مبيعات الموقع",
        amount=total_amount,
        description=f"طلب موقع #{order.order_number}",
        reference_id=order.id,
    ))

    db.commit()
    db.refresh(order)
    return order


@router.get("/track", response_model=schemas.OrderOut)
def track_order(order_number: str, phone: str, db: Session = Depends(get_db)):
    """Public tracking — requires BOTH the order number and the phone number
    used at checkout, so a guessed/leaked order number alone can't expose
    someone else's address and order details."""
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.order_number == order_number.strip().upper())
        .filter(models.Order.customer_phone == phone.strip())
        .first()
    )
    if not order:
        raise HTTPException(404, "الطلب غير موجود — تأكد من رقم الطلب ورقم التليفون")
    return order


# ---------------- Staff ----------------
@router.get("/", response_model=List[schemas.OrderOut], dependencies=[Depends(auth.get_current_staff)])
def list_orders(status: Optional[models.OrderStatus] = None, db: Session = Depends(get_db)):
    q = db.query(models.Order).options(joinedload(models.Order.items))
    if status:
        q = q.filter(models.Order.status == status)
    return q.order_by(models.Order.created_at.desc()).all()


@router.patch("/{order_id}/status", response_model=schemas.OrderOut, dependencies=[Depends(auth.get_current_staff)])
def update_order_status(order_id: str, payload: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order
