import random
import string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth, services, pricing, checkout
from ..database import get_db
from ..rate_limit import limiter

router = APIRouter(prefix="/orders", tags=["Orders"])


def _lock_and_price(db: Session, items: list) -> tuple[list, float]:
    """Locks each product row, checks it can be sold in that quantity, then
    prices every line through app/pricing.py — the same rules the catalog
    and the cart quote use, so the order is charged exactly what the
    customer was shown. Never trusts client prices."""
    merged = pricing.merge_lines(items)
    products = []
    # Lock in a fixed (id) order so two concurrent checkouts can't deadlock.
    for product_id in sorted(merged):
        product = (
            db.query(models.Product)
            .filter(models.Product.id == product_id)
            .filter(models.Product.is_active == True)  # noqa: E712
            .with_for_update()  # lock the row until this transaction commits —
            # closes the race where two concurrent checkouts both read the
            # same quantity before either deducts, causing overselling.
            # (No-op on SQLite; effective on the real PostgreSQL target.)
            .first()
        )
        if not product:
            raise HTTPException(409, "منتج في طلبك لم يعد متاحًا — احذفيه من السلة وحاولي تاني")
        if product.quantity < merged[product_id]:
            raise HTTPException(
                409,
                f"الكمية المطلوبة من «{product.name}» مش متاحة حاليًا — عدّلي الكمية وحاولي تاني",
            )
        products.append(product)

    offers = pricing.live_offers(db, (p.id for p in products))
    subtotal = 0.0
    line_specs = []
    for product in products:
        qty = merged[product.id]
        unit_price = pricing.unit_price(product, offers.get(product.id))
        line_total = unit_price * qty
        subtotal += line_total
        line_specs.append((product, qty, unit_price, line_total))
    return line_specs, subtotal


def _add_lines(db: Session, order: models.Order, line_specs: list, note: str) -> None:
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
            reference_id=order.id, note=note,
        )


def _own_pending_order(db: Session, order_id: str, customer: models.Customer, action: str) -> models.Order:
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id)
        .with_for_update(of=models.Order)
        .first()
    )
    if not order or order.customer_id != customer.id:
        # Someone else's order is reported as missing, not as forbidden.
        raise HTTPException(404, "الطلب غير موجود")
    if order.status == models.OrderStatus.cancelled:
        raise HTTPException(409, "الطلب ده اتلغى بالفعل")
    if order.status != models.OrderStatus.pending:
        raise HTTPException(409, f"الطلب خرج للشحن بالفعل ومينفعش {action} دلوقتي — كلمينا لو محتاجة مساعدة")
    return order


def _guest_profile(db: Session, phone: str, name: str) -> models.Customer:
    """The guest profile for this phone (created on first guest order).
    Accounts are never matched here."""
    query = (
        db.query(models.Customer)
        .filter(models.Customer.phone == phone)
        .filter(models.Customer.hashed_password.is_(None))
    )
    profile = query.first()
    if profile:
        return profile
    try:
        with db.begin_nested():
            profile = models.Customer(name=name, phone=phone)
            db.add(profile)
    except IntegrityError:
        # A concurrent guest checkout created it first (one guest profile
        # per phone is enforced by the database).
        profile = query.one()
    return profile


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
    line_specs, subtotal = _lock_and_price(db, payload.items)
    t = checkout.totals(db, subtotal, city=payload.city, coupon_code=payload.coupon_code, lock_coupon=True)
    checkout.require_orderable(t)

    # Signed in → the order belongs to that account (it shows in its history
    # and can be edited/cancelled there). Guest → it belongs to the guest
    # profile for that phone, never to an account: typing a phone number
    # proves nothing about who owns it.
    customer = logged_in_customer or _guest_profile(db, payload.customer_phone, payload.customer_name)

    order = models.Order(
        order_number=_generate_order_number(db),
        customer_id=customer.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        city=payload.city.strip(),
        shipping_address=payload.shipping_address.strip(),
        subtotal=subtotal,
        coupon_id=t.coupon.id if t.coupon else None,
        discount_amount=t.discount,
        shipping_fee=t.shipping_fee,
        total_amount=t.total,
        note=payload.note,
    )
    db.add(order)
    db.flush()
    _add_lines(db, order, line_specs, f"طلب موقع #{order.order_number}")

    if t.coupon:
        t.coupon.used_count += 1

    db.add(models.FinanceEntry(
        type=models.FinanceEntryType.income,
        category="مبيعات الموقع",
        amount=t.total,
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
    or update the city/address/note. Only allowed while the order is still
    'pending' (قيد التجهيز); once staff mark it 'shipped' (handed to
    delivery) or later, it's locked. Only the order's own customer can
    edit it — guest orders (no account) can't be edited this way."""
    order = _own_pending_order(db, order_id, customer, "تتعدّلي عليه")

    # Give back the stock the current items hold before repricing and
    # re-deducting for the new item list.
    for old_item in order.items:
        product = db.get(models.Product, old_item.product_id)
        if product:
            services.apply_stock_movement(
                db, product, old_item.quantity, models.MovementType.website_sale,
                reference_id=order.id, note=f"تعديل طلب #{order.order_number} — استرجاع كمية",
            )
    db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).delete()

    # Re-price the new item list from the current DB state, same as checkout.
    line_specs, subtotal = _lock_and_price(db, payload.items)

    # The order keeps its coupon (already counted) as long as the new
    # subtotal still meets its minimum; otherwise the discount and the
    # coupon use are released rather than charging a discount that no
    # longer qualifies.
    city = payload.city or order.city
    t = checkout.totals(db, subtotal, city=city, applied_coupon=order.coupon)
    if order.coupon is not None and t.coupon is None:
        checkout.release_coupon(order)
        order.coupon_id = None
    t.coupon_error = None
    checkout.require_orderable(t)

    order.subtotal = subtotal
    order.discount_amount = t.discount
    order.shipping_fee = t.shipping_fee
    order.total_amount = t.total
    order.city = city.strip()
    if payload.shipping_address:
        order.shipping_address = payload.shipping_address.strip()
    if payload.note is not None:
        order.note = payload.note

    _add_lines(db, order, line_specs, f"تعديل طلب #{order.order_number}")

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
        original_entry.amount = t.total

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
    rule as editing. Releases the reserved stock and the coupon use."""
    order = _own_pending_order(db, order_id, customer, "يتلغي")

    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product:
            services.apply_stock_movement(
                db, product, item.quantity, models.MovementType.website_sale,
                reference_id=order.id, note=f"إلغاء طلب #{order.order_number}",
            )
    checkout.release_coupon(order)
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
