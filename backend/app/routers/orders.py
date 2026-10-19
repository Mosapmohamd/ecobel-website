import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import abuse_limits, auth, checkout, models, pricing, schemas, services
from ..database import get_db
from ..rate_limit import limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/orders", tags=["Orders"])

# One answer for "no such order" and "wrong order number/phone pair", so a
# lookup can't tell which part was right.
NOT_FOUND = "مش لاقيين طلب بالبيانات دي — راجعي رقم الطلب ورقم التليفون"


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


# Order references: "EB" + 10 characters from `secrets` over an alphabet
# without look-alikes (no 0/O, 1/I/L) — ~49 bits, so a reference can't be
# guessed or enumerated. (Older orders keep their "EB" + 6-digit numbers.)
ORDER_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
ORDER_REF_LENGTH = 10


def _new_order_ref() -> str:
    return "EB" + "".join(secrets.choice(ORDER_REF_ALPHABET) for _ in range(ORDER_REF_LENGTH))


def _generate_order_number(db: Session) -> str:
    """A fresh reference not used by any order (the column is also unique
    in the database). A collision is astronomically unlikely; it's retried."""
    for _ in range(10):
        candidate = _new_order_ref()
        if not db.query(models.Order.id).filter(models.Order.order_number == candidate).first():
            return candidate
    raise HTTPException(500, "تعذر توليد رقم طلب فريد، حاول تاني")


def normalize_order_ref(value: str) -> str:
    """How a customer may type a reference: any case, with spaces or dashes."""
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())


def mask_order_ref(ref: str) -> str:
    """"EB7K4MQ9XR2T" → "EB••••••••2T": recognisable, not usable — 8 hidden
    characters of 31 are ~10^12 combinations. Shorter references (the old
    EB + 6 digits) show nothing after "EB": revealing 2 of 6 digits would
    leave only 10^4 to try against a known phone."""
    if len(ref) >= 2 + ORDER_REF_LENGTH:
        return ref[:2] + "•" * (len(ref) - 4) + ref[-2:]
    return ref[:2] + "•" * max(len(ref) - 2, 1)


@router.post("/", response_model=schemas.OrderOut, status_code=201)
@limiter.limit("5/minute")
def create_order(
    request: Request,
    payload: schemas.OrderCreate,
    db: Session = Depends(get_db),
    logged_in_customer: models.Customer | None = Depends(auth.get_current_customer_optional),
):
    client_ip = get_remote_address(request)
    # Cash-on-delivery orders are capped — pending orders per guest phone or
    # per account, and orders per IP per day (app/abuse_limits.py) — checked
    # before any stock moves so a refused request changes nothing.
    if logged_in_customer is None:
        ip_hash = abuse_limits.check_guest_order(db, payload.customer_phone, client_ip)
    else:
        ip_hash = abuse_limits.check_account_order(db, logged_in_customer.id, client_ip)

    line_specs, subtotal = _lock_and_price(db, payload.items)
    t = checkout.totals(db, subtotal, city=payload.city, coupon_code=payload.coupon_code, lock_coupon=True, client=client_ip)
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
        client_ip_hash=ip_hash,
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
    """Guest order lookup (no login):
    - order number + phone, both matching: the full order (address, items).
    - order number only, or phone only: status summaries with a masked
      reference — never the full order number, amount, address or items.
      Knowing a customer's phone must not lead to their address, so the
      phone-only answer can't be chained into a full lookup.
    A wrong combination gets the same answer as a non-existent order.
    Signed-in customers see their own orders under /account/orders.
    """
    ref = normalize_order_ref(order_number) if order_number else ""
    phone_n = schemas.normalize_egypt_phone(phone) if phone else ""
    if not ref and not phone_n:
        raise HTTPException(400, "لازم تدخلي رقم الطلب أو رقم التليفون على الأقل")

    if ref and phone_n:
        order = (
            db.query(models.Order)
            .options(joinedload(models.Order.items))
            .filter(models.Order.order_number == ref)
            .filter(models.Order.customer_phone == phone_n)
            .first()
        )
        if not order:
            raise HTTPException(404, NOT_FOUND)
        return schemas.OrderOut.model_validate(order)

    q = db.query(models.Order)
    q = q.filter(models.Order.order_number == ref) if ref else q.filter(models.Order.customer_phone == phone_n)
    orders = q.order_by(models.Order.created_at.desc()).all()
    if not orders:
        raise HTTPException(404, NOT_FOUND)
    return [
        schemas.OrderTrackSummary(reference=mask_order_ref(o.order_number), status=o.status, created_at=o.created_at)
        for o in orders
    ]


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
