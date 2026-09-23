import random
import string
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth, services
from ..database import get_db
from .coupons import _validate_coupon
from ..rate_limit import limiter

router = APIRouter(prefix="/orders", tags=["Orders"])

# Fallback delivery fee for a city with no configured ShippingRate row —
# actual per-city fees are set by staff in the accounting system.
DEFAULT_SHIPPING_FEE = 50.0
FREE_SHIPPING_THRESHOLD = 1000.0


def _shipping_fee(db: Session, city: str | None, net_subtotal: float) -> float:
    """Free shipping above the threshold regardless of city; otherwise the
    city's configured rate, falling back to DEFAULT_SHIPPING_FEE if the
    city isn't in the table (or wasn't given)."""
    if net_subtotal >= FREE_SHIPPING_THRESHOLD:
        return 0.0
    if city:
        rate = (
            db.query(models.ShippingRate)
            .filter(models.ShippingRate.city == city.strip())
            .filter(models.ShippingRate.is_active == True)  # noqa: E712
            .first()
        )
        if rate:
            return rate.fee
    return DEFAULT_SHIPPING_FEE


def _effective_price(db: Session, product: models.Product) -> float:
    """A product's real charged price: its own sale_price, unless it has
    an active, unexpired offer — in which case the offer price wins.
    Always computed server-side; never trust a client-sent price."""
    now = datetime.now(timezone.utc)
    offer = (
        db.query(models.Offer)
        .filter(models.Offer.product_id == product.id)
        .filter(models.Offer.is_active == True)  # noqa: E712
        .filter((models.Offer.expires_at.is_(None)) | (models.Offer.expires_at > now))
        .first()
    )
    return offer.offer_price if offer else product.sale_price


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
        unit_price = _effective_price(db, product)
        line_total = unit_price * item_in.quantity
        subtotal += line_total
        line_specs.append((product, item_in.quantity, unit_price, line_total))

    discount_amount = 0.0
    coupon = None
    if payload.coupon_code:
        coupon, reason, discount_amount = _validate_coupon(db, payload.coupon_code, subtotal)
        if not coupon:
            raise HTTPException(400, reason)

    shipping_fee = _shipping_fee(db, payload.city, subtotal - discount_amount)
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
        city=payload.city,
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

    for product, qty, unit_price, line_total in line_specs:
        db.add(models.OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=unit_price,
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
        source="website",
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


@router.patch("/{order_id}", response_model=schemas.OrderOut)
def edit_order(
    order_id: str,
    payload: schemas.OrderEdit,
    db: Session = Depends(get_db),
    customer: models.Customer = Depends(auth.get_current_customer),
):
    """Customer self-service order editing — add, remove, or change items,
    or update the address/note. Only allowed while the order is still
    'pending' (قيد التجهيز); once staff mark it 'shipped' (handed to
    delivery) or later, it's locked. Only the order's own customer can
    edit it — guest orders (no account) can't be edited this way."""
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    if order.customer_id != customer.id:
        raise HTTPException(403, "مش مسموحلك تعدّلي على الطلب ده")
    if order.status != models.OrderStatus.pending:
        raise HTTPException(400, "الطلب دخل مرحلة الشحن بالفعل ومينفعش تتعدّل عليه دلوقتي")

    # Reverse the stock movements for the current items (restore quantities)
    # before repricing/re-deducting for the new item list.
    for old_item in order.items:
        product = db.get(models.Product, old_item.product_id)
        if product:
            services.apply_stock_movement(
                db, product, old_item.quantity, models.MovementType.website_sale,
                reference_id=order.id, note=f"تعديل طلب #{order.order_number} — استرجاع كمية",
            )
    db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).delete()

    # Re-price the new item list from the current DB state, same as checkout.
    subtotal = 0.0
    line_specs = []
    for item_in in payload.items:
        product = (
            db.query(models.Product)
            .filter(models.Product.id == item_in.product_id)
            .filter(models.Product.is_active == True)  # noqa: E712
            .with_for_update()
            .first()
        )
        if not product:
            raise HTTPException(404, f"منتج غير موجود: {item_in.product_id}")
        unit_price = _effective_price(db, product)
        line_total = unit_price * item_in.quantity
        subtotal += line_total
        line_specs.append((product, item_in.quantity, unit_price, line_total))

    # Re-check the existing coupon (if any) against the new subtotal — drop
    # it if it no longer qualifies (e.g. below its minimum order amount)
    # rather than re-charging a discount that isn't valid anymore.
    discount_amount = 0.0
    if order.coupon_id and order.coupon:
        coupon, _reason, discount_amount = _validate_coupon(db, order.coupon.code, subtotal)
        if not coupon:
            discount_amount = 0.0
            order.coupon_id = None

    shipping_fee = _shipping_fee(db, payload.city or order.city, subtotal - discount_amount)
    total_amount = subtotal - discount_amount + shipping_fee

    order.subtotal = subtotal
    order.discount_amount = discount_amount
    order.shipping_fee = shipping_fee
    order.total_amount = total_amount
    if payload.city:
        order.city = payload.city
    if payload.shipping_address:
        order.shipping_address = payload.shipping_address
    if payload.note is not None:
        order.note = payload.note

    for product, qty, unit_price, line_total in line_specs:
        db.add(models.OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=unit_price,
            quantity=qty,
            line_total=line_total,
        ))
        services.apply_stock_movement(
            db, product, -qty, models.MovementType.website_sale,
            reference_id=order.id, note=f"تعديل طلب #{order.order_number}",
        )

    # The original income entry (created at checkout) was for the old
    # total — correct it in place rather than leaving stale accounting
    # data or creating a second, confusing income row for the same order.
    original_entry = (
        db.query(models.FinanceEntry)
        .filter(models.FinanceEntry.reference_id == order.id)
        .filter(models.FinanceEntry.type == models.FinanceEntryType.income)
        .first()
    )
    if original_entry:
        original_entry.amount = total_amount

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", response_model=schemas.OrderOut)
def cancel_order(
    order_id: str,
    db: Session = Depends(get_db),
    customer: models.Customer = Depends(auth.get_current_customer),
):
    """Customer self-service cancellation — same pending-only, own-order-only
    rule as editing. Releases the reserved stock back."""
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "الطلب غير موجود")
    if order.customer_id != customer.id:
        raise HTTPException(403, "مش مسموحلك تلغي الطلب ده")
    if order.status != models.OrderStatus.pending:
        raise HTTPException(400, "الطلب دخل مرحلة الشحن بالفعل ومينفعش يتلغي دلوقتي")

    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product:
            services.apply_stock_movement(
                db, product, item.quantity, models.MovementType.website_sale,
                reference_id=order.id, note=f"إلغاء طلب #{order.order_number}",
            )
    order.status = models.OrderStatus.cancelled

    db.add(models.FinanceEntry(
        type=models.FinanceEntryType.expense,
        category="إلغاء طلب موقع",
        amount=order.total_amount,
        description=f"إلغاء طلب #{order.order_number}",
        reference_id=order.id,
        source="website",
    ))

    db.commit()
    db.refresh(order)
    return order
