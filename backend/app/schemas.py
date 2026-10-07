from datetime import datetime
import re
from typing import Literal, Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator

from .models import OrderStatus

_EGYPT_PHONE_RE = re.compile(r"^01\d{9}$")


def _validate_full_name(value: str) -> str:
    parts = [p for p in value.strip().split(" ") if p]
    if len(parts) != 3:
        raise ValueError("الاسم لازم يكون ثلاثي (اسم أول، أب، جد) مفصول بمسافات")
    return " ".join(parts)


def _validate_egypt_phone(value: str) -> str:
    value = value.strip()
    if not _EGYPT_PHONE_RE.match(value):
        raise ValueError("رقم التليفون لازم يبدأ بـ 01 ويتكون من 11 رقم")
    return value


# ---------------- Auth (staff) ----------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------- Customer accounts ----------------
class CustomerRegister(BaseModel):
    name: str = Field(..., max_length=120)
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=500)
    password: str = Field(..., max_length=128)

    @field_validator("name")
    @classmethod
    def _check_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("اكتبي اسمك")
        return v

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, v: str) -> str:
        return _validate_egypt_phone(v)

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل")
        return v


class CustomerLogin(BaseModel):
    phone: str = Field(..., max_length=20)
    password: str = Field(..., max_length=128)


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    phone: str
    email: Optional[str]
    address: Optional[str]
    created_at: datetime


# ---------------- Catalog (read-only here) ----------------
class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    product_count: int = 0


class OfferBrief(BaseModel):
    id: str
    title: str
    offer_price: float


class ProductOut(BaseModel):
    """A product as the storefront sells it. `price` is what checkout will
    charge (see app/pricing.py); `sale_price` is the regular price, shown
    struck through when an `offer` applies."""
    id: str
    name: str
    category_id: str
    category_name: str
    sku: Optional[str]
    sale_price: float
    price: float
    offer: Optional[OfferBrief] = None
    stock_status: str
    # Most a customer can order right now (0 = unavailable). Capped at the
    # per-line checkout limit, so exact stock levels aren't published.
    max_quantity: int
    image_url: Optional[str] = None
    description: Optional[str] = None


class ProductPage(BaseModel):
    items: List[ProductOut]
    total: int
    limit: int
    offset: int


# ---------------- Orders / Checkout ----------------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderCreate(BaseModel):
    customer_name: str = Field(..., max_length=120)
    customer_phone: str
    city: str = Field(..., min_length=1, max_length=100)
    shipping_address: str = Field(..., min_length=5, max_length=500)
    items: List[OrderItemIn] = Field(..., min_length=1, max_length=30)
    coupon_code: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("customer_name")
    @classmethod
    def _check_name(cls, v: str) -> str:
        return _validate_full_name(v)

    @field_validator("customer_phone")
    @classmethod
    def _check_phone(cls, v: str) -> str:
        return _validate_egypt_phone(v)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: str
    product_name: str
    unit_price: float
    quantity: int
    line_total: float


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_number: str
    customer_name: str
    customer_phone: str
    city: Optional[str] = None
    shipping_address: str
    status: OrderStatus
    payment_method: str
    subtotal: float
    discount_amount: float
    shipping_fee: float
    total_amount: float
    note: Optional[str]
    created_at: datetime
    items: List[OrderItemOut]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderTrackSummary(BaseModel):
    """Reduced view used when only one of order_number/phone is given —
    confirms the order exists and its status, without exposing the
    address or full item list to someone who only guessed one credential."""
    model_config = ConfigDict(from_attributes=True)
    order_number: str
    status: OrderStatus
    total_amount: float
    created_at: datetime


# ---------------- Routines (read-only here) ----------------
class RoutineItemOut(BaseModel):
    product: ProductOut
    regular_price: float
    price: float


class RoutineOut(BaseModel):
    """A routine priced from its products' current prices. `savings` is
    what live offers on its products take off the regular total."""
    id: str
    name: str
    description: Optional[str]
    items: List[RoutineItemOut]
    regular_total: float
    total: float
    savings: float
    is_available: bool


# ---------------- Cart quote ----------------
class CartLineIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class CartQuoteRequest(BaseModel):
    items: List[CartLineIn] = Field(..., max_length=30)
    # Optional checkout context — when given, the quote also returns the
    # discount, shipping fee and final total exactly as checkout charges.
    city: Optional[str] = Field(None, max_length=100)
    coupon_code: Optional[str] = Field(None, max_length=50)


class CartQuoteLine(BaseModel):
    product_id: str
    quantity: int
    product: Optional[ProductOut] = None
    unit_price: float = 0
    regular_unit_price: float = 0
    line_total: float = 0
    # None = orderable as-is; otherwise why it can't be ordered right now.
    issue: Optional[Literal["unavailable", "out_of_stock", "insufficient_stock"]] = None


class CouponStatus(BaseModel):
    code: str
    valid: bool
    reason: Optional[str] = None


class CartQuote(BaseModel):
    lines: List[CartQuoteLine]
    subtotal: float
    regular_subtotal: float
    savings: float
    has_issues: bool
    coupon: Optional[CouponStatus] = None
    discount: float = 0
    # None until a deliverable city is chosen (unless shipping is free).
    shipping_fee: Optional[float] = None
    city_error: Optional[str] = None
    free_shipping_threshold: float
    total: float


# ---------------- Order editing (customer, pending orders only) ----------------
class OrderItemEdit(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderEdit(BaseModel):
    items: List[OrderItemEdit] = Field(..., min_length=1, max_length=30)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    shipping_address: Optional[str] = Field(None, min_length=5, max_length=500)
    note: Optional[str] = Field(None, max_length=500)


class ShippingRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    city: str
    fee: float


# ---------------- Product reviews ----------------
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer_name: str
    rating: int
    comment: Optional[str]
    created_at: datetime


class ReviewSummary(BaseModel):
    average_rating: float
    review_count: int
    reviews: List[ReviewOut]


class ReviewEligibility(BaseModel):
    can_review: bool
    reason: Optional[str] = None
