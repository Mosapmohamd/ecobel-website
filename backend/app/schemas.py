from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr

from .models import CouponDiscountType, OrderStatus


# ---------------- Auth (staff) ----------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


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


# ---------------- Coupons ----------------
class CouponValidateRequest(BaseModel):
    code: str
    order_subtotal: float = Field(..., ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    discount_amount: float = 0


class CouponCreate(BaseModel):
    code: str
    discount_type: CouponDiscountType
    discount_value: float = Field(..., gt=0)
    min_order_amount: float = Field(0, ge=0)
    max_uses: Optional[int] = Field(None, gt=0)
    expires_at: Optional[datetime] = None


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
