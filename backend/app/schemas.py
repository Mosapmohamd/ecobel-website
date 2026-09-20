from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr

from .models import CouponDiscountType, OrderStatus


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


# ---------------- Admin: categories & products ----------------
class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


class ProductAdminCreate(BaseModel):
    name: str
    category_id: str
    sku: Optional[str] = None
    sale_price: float = Field(0, ge=0)
    quantity: int = Field(0, ge=0)
    low_stock_threshold: int = Field(10, ge=0)


class ProductAdminUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    sku: Optional[str] = None
    sale_price: Optional[float] = Field(None, ge=0)
    quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


# ---------------- Admin: sales analytics ----------------
class RevenuePoint(BaseModel):
    date: str
    total: float


class TopProduct(BaseModel):
    product_name: str
    quantity_sold: int
    revenue: float


class SalesAnalytics(BaseModel):
    total_revenue: float
    total_orders: int
    orders_by_status: dict[str, int]
    revenue_last_30_days: List[RevenuePoint]
    top_products: List[TopProduct]


# ---------------- Coupons ----------------
class CouponValidateRequest(BaseModel):
    code: str
    order_subtotal: float = Field(..., ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    discount_amount: float = 0


class CouponLimitType(str, PyEnum):
    duration = "duration"
    count = "count"
    unlimited = "unlimited"


class CouponCreate(BaseModel):
    code: str
    discount_type: CouponDiscountType
    discount_value: float = Field(..., gt=0)
    min_order_amount: float = Field(0, ge=0)
    limit_type: CouponLimitType = CouponLimitType.unlimited
    max_uses: Optional[int] = Field(None, gt=0, description="Required when limit_type is 'count'")
    expires_at: Optional[datetime] = Field(None, description="Required when limit_type is 'duration'")


class CouponUpdate(BaseModel):
    discount_value: Optional[float] = Field(None, gt=0)
    min_order_amount: Optional[float] = Field(None, ge=0)
    limit_type: Optional[CouponLimitType] = None
    max_uses: Optional[int] = Field(None, gt=0)
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    discount_type: CouponDiscountType
    discount_value: float
    min_order_amount: float
    max_uses: Optional[int]
    used_count: int
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime


# ---------------- Orders / Checkout ----------------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    shipping_address: str
    items: List[OrderItemIn] = Field(..., min_length=1, max_length=30)
    coupon_code: Optional[str] = None
    note: Optional[str] = None


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
