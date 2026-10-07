import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, Boolean, UniqueConstraint,
    CheckConstraint, Index, text,
)
from sqlalchemy.orm import relationship

from .database import Base
from .product_images import public_url


def gen_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


# =============================================================================
# SHARED TABLES — must stay byte-for-byte identical (table name, columns,
# enum values) to the definitions in ecobel-accounting-system/backend/app/models.py.
# Both services read and write these same rows. If you change a shared
# model here, make the identical change there (and vice versa), then run
# `alembic revision --autogenerate` in the service that owns the migration
# history for that table.
# =============================================================================

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    sku = Column(String, unique=True, nullable=True)
    sale_price = Column(Float, nullable=False, default=0)
    quantity = Column(Integer, nullable=False, default=0)
    low_stock_threshold = Column(Integer, nullable=False, default=10)
    is_active = Column(Boolean, default=True)
    # Storage key of the product photo ("products/<id>/<random>.<ext>") —
    # see app/product_images.py; `image_url` is the public URL built from it.
    image_key = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    category = relationship("Category", back_populates="products")

    @property
    def stock_status(self) -> str:
        if self.quantity <= 0:
            return "out"
        if self.quantity <= self.low_stock_threshold:
            return "low"
        return "ok"

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else ""

    @property
    def image_url(self) -> str | None:
        return public_url(self.image_key)


class MovementType(str, enum.Enum):
    restock = "restock"
    adjustment = "adjustment"
    website_sale = "website_sale"
    b2b_sale = "b2b_sale"
    free_distribution = "free_distribution"


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    type = Column(Enum(MovementType, native_enum=False), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    reference_id = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)

    product = relationship("Product")


class FinanceEntryType(str, enum.Enum):
    income = "income"
    expense = "expense"


class FinanceEntry(Base):
    __tablename__ = "finance_entries"

    id = Column(String, primary_key=True, default=gen_id)
    type = Column(Enum(FinanceEntryType, native_enum=False), nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    reference_id = Column(String, nullable=True)
    source = Column(String, nullable=True)  # "website" | "b2b" | "spending"
    entry_date = Column(DateTime(timezone=True), default=now)
    created_at = Column(DateTime(timezone=True), default=now)


# =============================================================================
# WEBSITE-WRITTEN TABLES — this service creates customers, orders and order
# items at registration/checkout and increments coupon usage; the accounting
# system manages them afterwards (order status, cancellation, coupon CRUD).
# =============================================================================

class Customer(Base):
    """Two kinds of row that are never merged: an account (has a password,
    signs in, owns the orders it places while signed in) and a guest
    profile (no password; groups the guest orders placed with one phone).
    A phone number alone never proves ownership, so guest checkout never
    touches an account and registering never takes over a guest profile.
    At most one account and one guest profile per phone."""
    __tablename__ = "customers"
    __table_args__ = (
        Index("uq_customers_account_phone", "phone", unique=True,
              postgresql_where=text("hashed_password IS NOT NULL"), sqlite_where=text("hashed_password IS NOT NULL")),
        Index("uq_customers_guest_phone", "phone", unique=True,
              postgresql_where=text("hashed_password IS NULL"), sqlite_where=text("hashed_password IS NULL")),
    )

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    hashed_password = Column(String, nullable=True)  # NULL = guest profile
    created_at = Column(DateTime(timezone=True), default=now)

    orders = relationship("Order", back_populates="customer")

    @property
    def is_account(self) -> bool:
        return self.hashed_password is not None


class CouponDiscountType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(String, primary_key=True, default=gen_id)
    code = Column(String, unique=True, nullable=False, index=True)
    discount_type = Column(Enum(CouponDiscountType, native_enum=False), nullable=False)
    discount_value = Column(Float, nullable=False)  # percentage (0-100) or fixed EGP amount
    min_order_amount = Column(Float, nullable=False, default=0)
    max_uses = Column(Integer, nullable=True)  # null = unlimited
    used_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)


class OrderStatus(str, enum.Enum):
    pending = "pending"        # قيد التجهيز
    shipped = "shipped"        # في الطريق
    delivered = "delivered"    # تم التوصيل
    cancelled = "cancelled"    # ملغي


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_id)
    order_number = Column(String, unique=True, nullable=False, index=True)  # short human-friendly ref
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)

    # Snapshot contact/shipping info at order time — kept even if the
    # Customer record changes later, and populated for guest checkout too.
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    city = Column(String, nullable=True)  # drives the shipping fee — see ShippingRate
    shipping_address = Column(Text, nullable=False)

    status = Column(Enum(OrderStatus, native_enum=False), nullable=False, default=OrderStatus.pending)
    payment_method = Column(String, nullable=False, default="cash_on_delivery")

    subtotal = Column(Float, nullable=False, default=0)
    coupon_id = Column(String, ForeignKey("coupons.id"), nullable=True)
    discount_amount = Column(Float, nullable=False, default=0)
    shipping_fee = Column(Float, nullable=False, default=0)
    total_amount = Column(Float, nullable=False, default=0)

    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    customer = relationship("Customer", back_populates="orders")
    coupon = relationship("Coupon")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=gen_id)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    product_name = Column(String, nullable=False)  # snapshot — survives product renames
    unit_price = Column(Float, nullable=False)      # snapshot of Product.sale_price at order time
    quantity = Column(Integer, nullable=False)
    line_total = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")



# ===========================================================================
# WEBSITE MERCHANDISING — mirrored from ecobel-accounting-system, which owns
# and manages these. This service only reads them for the homepage and to
# price offer products correctly at checkout.
# ===========================================================================

class Offer(Base):
    __tablename__ = "offers"

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    title = Column(String, nullable=False)
    offer_price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)

    product = relationship("Product")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product else ""

    @property
    def original_price(self) -> float:
        return self.product.sale_price if self.product else 0

    @property
    def image_url(self) -> str | None:
        return self.product.image_url if self.product else None


class Routine(Base):
    __tablename__ = "routines"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now)

    items = relationship("RoutineItem", back_populates="routine", cascade="all, delete-orphan", order_by="RoutineItem.position")


class RoutineItem(Base):
    __tablename__ = "routine_items"

    id = Column(String, primary_key=True, default=gen_id)
    routine_id = Column(String, ForeignKey("routines.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    routine = relationship("Routine", back_populates="items")
    product = relationship("Product")

    @property
    def product_name(self) -> str:
        return self.product.name if self.product else ""

    @property
    def sale_price(self) -> float:
        return self.product.sale_price if self.product else 0

    @property
    def image_url(self) -> str | None:
        return self.product.image_url if self.product else None


class ShippingRate(Base):
    """Mirrored from ecobel-accounting-system, which owns and manages this —
    city -> delivery fee, looked up at checkout."""
    __tablename__ = "shipping_rates"

    id = Column(String, primary_key=True, default=gen_id)
    city = Column(String, unique=True, nullable=False)
    fee = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now)


class Review(Base):
    """A customer's rating/comment on a product they've actually ordered
    before (verified server-side at creation, never trusted from the
    client). Hidden from the public until a staff member approves it from
    the accounting system's moderation queue."""
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("customer_id", "product_id", name="uq_review_customer_product"),)

    id = Column(String, primary_key=True, default=gen_id)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    is_approved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=now)

    product = relationship("Product")
    customer = relationship("Customer")

    @property
    def customer_name(self) -> str:
        return self.customer.name if self.customer else ""


# ===========================================================================
# HOMEPAGE MERCHANDISING — owned and managed by ecobel-accounting-system
# (المتجر الإلكتروني ← واجهة المتجر); the website only reads these.
# One row per homepage slot: `position` is the display order (1 = first),
# and a product/routine can hold at most one slot. The CHECK constraints
# cap the homepage at 8 featured products and 2 featured routines.
# ===========================================================================

FEATURED_PRODUCTS_MAX = 8
FEATURED_ROUTINES_MAX = 2


class FeaturedProduct(Base):
    __tablename__ = "featured_products"
    __table_args__ = (
        CheckConstraint(f"position BETWEEN 1 AND {FEATURED_PRODUCTS_MAX}", name="ck_featured_products_position"),
    )

    position = Column(Integer, primary_key=True, autoincrement=False)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    product = relationship("Product")


class FeaturedRoutine(Base):
    __tablename__ = "featured_routines"
    __table_args__ = (
        CheckConstraint(f"position BETWEEN 1 AND {FEATURED_ROUTINES_MAX}", name="ck_featured_routines_position"),
    )

    position = Column(Integer, primary_key=True, autoincrement=False)
    routine_id = Column(String, ForeignKey("routines.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    routine = relationship("Routine")
