import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth, services
from ..database import get_db
from .coupons import _validate_coupon
from ..rate_limit import limiter

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
@limiter.limit("5/minute")
def create_order(
    request: Request,
    payload: schemas.OrderCreate,
    db: Session = Depends(get_db),
    logged_in_customer: models.Customer | None = Depends(auth.get_current_customer_optional),
):
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
            .with_for_update()  # lock the row until this transaction commits —
            # closes the race where two concurrent checkouts both read the
            # same quantity before either deducts, causing overselling.
            # (No-op on SQLite; effective on the real PostgreSQL target.)
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

    # Link to the logged-in customer's real account if they're authenticated;
    # otherwise fall back to the phone-based guest find-or-create as before.
    if logged_in_customer:
        customer = logged_in_customer
    else:
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


@router.get("/track")
@limiter.limit("5/minute")
def track_order(
    request: Request,
    order_number: Optional[str] = None,
    phone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Flexible order lookup:
    - order_number + phone (both match): full order details.
    - order_number only: status-only confirmation (no address/items) —
      knowing the order number alone shouldn't reveal where it's going.
    - phone only: status-only list of every order for that phone — same
      reasoning, and it's a list since one phone can have many orders.
    """
    if not order_number and not phone:
        raise HTTPException(400, "لازم تدخلي رقم الطلب أو رقم التليفون على الأقل")

    if order_number and phone:
        order = (
            db.query(models.Order)
            .options(joinedload(models.Order.items))
            .filter(models.Order.order_number == order_number.strip().upper())
            .filter(models.Order.customer_phone == phone.strip())
            .first()
        )
        if not order:
            raise HTTPException(404, "الطلب غير موجود — تأكدي من رقم الطلب ورقم التليفون")
        return schemas.OrderOut.model_validate(order)

    if order_number:
        order = (
            db.query(models.Order)
            .filter(models.Order.order_number == order_number.strip().upper())
            .first()
        )
        if not order:
            raise HTTPException(404, "مفيش طلب بالرقم ده")
        return [schemas.OrderTrackSummary.model_validate(order)]

    orders = (
        db.query(models.Order)
        .filter(models.Order.customer_phone == phone.strip())
        .order_by(models.Order.created_at.desc())
        .all()
    )
    if not orders:
        raise HTTPException(404, "مفيش طلبات مسجّلة بالرقم ده")
    return [schemas.OrderTrackSummary.model_validate(o) for o in orders]

