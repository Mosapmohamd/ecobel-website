import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, Boolean
)
from sqlalchemy.orm import relationship

from .database import Base


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
    image_url = Column(String, nullable=True)
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
    type = Column(Enum(MovementType), nullable=False)
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
    type = Column(Enum(FinanceEntryType), nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    reference_id = Column(String, nullable=True)
    source = Column(String, nullable=True)  # "website" | "b2b" | "spending"
    entry_date = Column(DateTime(timezone=True), default=now)
    created_at = Column(DateTime(timezone=True), default=now)


# =============================================================================
# WEBSITE-ONLY TABLES — owned by this service; ecobel-accounting-system
# never reads or writes these.
# =============================================================================

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    # Nullable — guest checkout doesn't create a login-capable account.
    hashed_password = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)

    orders = relationship("Order", back_populates="customer")


class CouponDiscountType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(String, primary_key=True, default=gen_id)
    code = Column(String, unique=True, nullable=False, index=True)
    discount_type = Column(Enum(CouponDiscountType), nullable=False)
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

    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending)
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
