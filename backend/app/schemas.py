from datetime import datetime
import re
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator

from .models import CouponDiscountType, OrderStatus

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
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    password: str = Field(..., min_length=6)


class CustomerLogin(BaseModel):
    phone: str
    password: str


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


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category_id: str
    category_name: str
    sku: Optional[str]
    sale_price: float
    quantity: int
    stock_status: str
    image_url: Optional[str] = None
    description: Optional[str] = None


# ---------------- Coupons ----------------
class CouponValidateRequest(BaseModel):
    code: str
    order_subtotal: float = Field(..., ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    discount_amount: float = 0


# ---------------- Orders / Checkout ----------------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    city: str = Field(..., min_length=1)
    shipping_address: str
    items: List[OrderItemIn] = Field(..., min_length=1, max_length=30)
    coupon_code: Optional[str] = None
    note: Optional[str] = None

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


# ---------------- Homepage: offers & routines (read-only) ----------------
class OfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    product_name: str
    original_price: float
    image_url: Optional[str] = None
    title: str
    offer_price: float


class RoutineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: str
    product_name: str
    sale_price: float
    image_url: Optional[str] = None


class RoutineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str]
    items: List[RoutineItemOut]


# ---------------- Order editing (customer, pending orders only) ----------------
class OrderItemEdit(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderEdit(BaseModel):
    items: List[OrderItemEdit] = Field(..., min_length=1, max_length=30)
    city: Optional[str] = None
    shipping_address: Optional[str] = None
    note: Optional[str] = None


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
