from datetime import datetime
import re
from typing import Literal, Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr, computed_field, field_validator, model_validator

from .models import OrderStatus

_EGYPT_PHONE_RE = re.compile(r"^01\d{9}$")


def _validate_full_name(value: str) -> str:
    parts = [p for p in value.strip().split(" ") if p]
    if len(parts) != 3:
        raise ValueError("الاسم لازم يكون ثلاثي (اسم أول، أب، جد) مفصول بمسافات")
    return " ".join(parts)


_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def normalize_egypt_phone(value: str) -> str:
    """One canonical form (01XXXXXXXXX) for every way a customer may type a
    number: Arabic-Indic digits, spaces/dashes/dots/brackets, or the +20 /
    0020 / 20 country code. Used wherever a phone is stored, compared or
    limited, so formatting can't create a "different" number."""
    value = (value or "").translate(_DIGITS)
    value = "".join(ch for ch in value if ch.isdigit() or ch == "+")
    if value.startswith("+20"):
        value = "0" + value[3:]
    elif value.startswith("0020"):
        value = "0" + value[4:]
    elif value.startswith("20") and len(value) == 12:
        value = "0" + value[2:]
    return value


def _validate_egypt_phone(value: str) -> str:
    value = normalize_egypt_phone(value)
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
        # New passwords only — sign-in never checks length, so existing
        # accounts with shorter passwords keep working.
        if len(v) < 8:
            raise ValueError("كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل")
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


class PromotionBadge(BaseModel):
    """A cart-level offer (app/promotions.py) a product takes part in."""
    id: str
    name: str
    type: str
    badge_text: Optional[str] = None
    summary: str
    description: Optional[str] = None
    # "reward": the product is the gift of a Buy X Get Y offer.
    role: Literal["eligible", "reward"] = "eligible"


class PromotionPublic(PromotionBadge):
    ends_at: Optional[datetime] = None
    # Empty lists = the offer applies to every product.
    product_ids: List[str] = []
    category_ids: List[str] = []
    reward_product_ids: List[str] = []
    reward_category_ids: List[str] = []


class BundleProductOut(BaseModel):
    product: "ProductOut"
    quantity: int = 1  # units per bundle (fixed bundles)


class BundleOffer(PromotionPublic):
    """A live bundle offer with everything its card needs. Fixed bundles list
    their exact contents; choose-your-own bundles list the products the
    customer can choose from (only sellable ones)."""
    fixed: bool
    bundle_price: float
    bundle_quantity: int
    distinct_products: bool = False
    max_bundles: Optional[int] = None
    products: List[BundleProductOut]
    # Fixed bundles: the contents' regular total and the saving per bundle.
    regular_total: Optional[float] = None
    savings: Optional[float] = None
    available: bool = True


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
    # Every photo URL for the product page's gallery, main photo first.
    # Filled only by the single-product endpoint; empty in listings.
    images: List[str] = []
    short_description: Optional[str] = None
    description: Optional[str] = None
    # Live cart offers this product takes part in (badges; the cart applies them).
    promotions: List[PromotionBadge] = []


class ProductPage(BaseModel):
    items: List[ProductOut]
    total: int
    limit: int
    offset: int


# ---------------- Orders / Checkout ----------------
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class BundleItemIn(BaseModel):
    product_id: str = Field(..., max_length=64)
    quantity: int = Field(..., gt=0, le=50)  # units of this product in ONE bundle


class BundleIn(BaseModel):
    """A bundle offer added to the cart as one item: which products (per
    bundle) and how many bundles. Never a price — the server prices it."""
    promotion_id: str = Field(..., max_length=64)
    quantity: int = Field(1, gt=0, le=20)
    items: List[BundleItemIn] = Field(..., min_length=1, max_length=30)


def _not_empty(items, bundles) -> None:
    if not items and not bundles:
        raise ValueError("السلة فاضية")


class OrderCreate(BaseModel):
    customer_name: str = Field(..., max_length=120)
    customer_phone: str
    city: str = Field(..., min_length=1, max_length=100)
    shipping_address: str = Field(..., min_length=5, max_length=500)
    items: List[OrderItemIn] = Field([], max_length=30)
    bundles: List[BundleIn] = Field([], max_length=10)
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

    @model_validator(mode="after")
    def _has_something(self):
        _not_empty(self.items, self.bundles)
        return self


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: str
    product_name: str
    unit_price: float
    quantity: int
    line_total: float


class OrderPromotionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    promotion_id: str
    name: str
    type: str
    discount: float
    shipping_discount: float
    details: dict = Field({}, exclude=True)  # read for `bundles` below, not sent


class OrderBundleItemOut(BaseModel):
    product_id: str
    product_name: str
    quantity: int  # per bundle


class OrderBundleOut(BaseModel):
    """A bundle in an order, as the customer added it."""
    promotion_id: str
    name: str
    quantity: int
    items: List[OrderBundleItemOut]
    price: float
    discount: float


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
    promotion_discount: float = 0
    shipping_fee: float
    total_amount: float
    note: Optional[str]
    created_at: datetime
    items: List[OrderItemOut]
    applied_promotions: List[OrderPromotionOut] = []

    @computed_field
    @property
    def bundles(self) -> List[OrderBundleOut]:
        names = {i.product_id: i.product_name for i in self.items}
        out = []
        for p in self.applied_promotions:
            for g in (p.details or {}).get("groups") or [] if p.type == "bundle" else []:
                out.append(OrderBundleOut(
                    promotion_id=p.promotion_id, name=p.name, quantity=int(g.get("count", 1)),
                    items=[OrderBundleItemOut(product_id=i["product_id"], product_name=names.get(i["product_id"], ""), quantity=int(i["quantity"]))
                           for i in g.get("items", [])],
                    price=float(g.get("price", 0)), discount=float(g.get("discount", 0)),
                ))
        return out


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderTrackSummary(BaseModel):
    """Reduced view when only one of order number / phone is given: the
    order exists and its status. Never the full order number (it unlocks
    the details together with the phone), the amount, the address or the
    items — someone may know a customer's phone without being them."""
    reference: str  # masked, e.g. "EB••••••7K"
    status: OrderStatus
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
    bundles: List[BundleIn] = Field([], max_length=10)
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
    # Promotion discount on this line (bundles, % / fixed offers, gifts) and
    # how many of its units are free gifts.
    promotion_discount: float = 0
    free_units: int = 0
    # None = orderable as-is; otherwise why it can't be ordered right now.
    issue: Optional[Literal["unavailable", "out_of_stock", "insufficient_stock"]] = None


class CouponStatus(BaseModel):
    code: str
    valid: bool
    reason: Optional[str] = None


class CartBundleItem(BaseModel):
    product_id: str
    quantity: int  # per bundle
    product: Optional[ProductOut] = None
    unit_price: float = 0


class CartBundle(BaseModel):
    """A bundle in the cart, priced by the server. `issue` set = it can't be
    ordered like this (the reason says why); the cart must fix it first."""
    promotion_id: str
    name: str = ""
    badge_text: Optional[str] = None
    summary: str = ""
    fixed: bool = False
    quantity: int
    items: List[CartBundleItem]
    regular_total: float = 0
    total: float = 0
    discount: float = 0
    issue: Optional[str] = None


class AppliedPromotion(BaseModel):
    id: str
    name: str
    type: str
    badge_text: Optional[str] = None
    summary: str
    discount: float = 0
    shipping_discount: float = 0
    detail: dict = {}


class PromotionHint(BaseModel):
    """An offer this cart is related to but doesn't get (yet), and why."""
    id: str
    name: str
    type: str
    badge_text: Optional[str] = None
    summary: str
    reason: str


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
    # Promotions (app/promotions.py): product discount, the waived shipping
    # fee, what applied and what didn't (with the reason).
    promotion_discount: float = 0
    shipping_discount: float = 0
    promotions: List[AppliedPromotion] = []
    promotion_hints: List[PromotionHint] = []
    bundles: List[CartBundle] = []
    # Everything the customer saves: product offers + promotions + coupon + shipping.
    total_savings: float = 0


# ---------------- Order editing (customer, pending orders only) ----------------
class OrderItemEdit(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=100)


class OrderEdit(BaseModel):
    items: List[OrderItemEdit] = Field([], max_length=30)
    # None = keep the order's bundles as they are; a list replaces them.
    bundles: Optional[List[BundleIn]] = Field(None, max_length=10)
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


BundleProductOut.model_rebuild()
BundleOffer.model_rebuild()


# ---------------- Storefront settings: the announcement bar ----------------
# KEEP IDENTICAL in ecobel-accounting-system and ecobel-website (schemas.py):
# the accounting system validates what it saves, the storefront validates
# again what it serves. Structured fields only — the text is plain text (no
# markup), colours are named themes, the link is a site path or https URL.
_ANNOUNCEMENT_TEXT_MAX = 200
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _plain_text(v):
    if v is None:
        return None
    v = _CONTROL_CHARS.sub(" ", str(v)).strip()
    if "<" in v or ">" in v:
        raise ValueError("النص لازم يكون كلام عادي من غير رموز < أو >")
    return v or None


def _safe_link(v):
    if v is None or not str(v).strip():
        return None
    v = str(v).strip()
    if len(v) > 300 or any(c.isspace() or c in "<>\"'`\\" for c in v):
        raise ValueError("الرابط غير صحيح")
    if v.startswith("/") and not v.startswith("//"):
        return v  # a page of the site, e.g. /products?offers=1
    m = re.match(r"^https://([A-Za-z0-9.-]+\.[A-Za-z]{2,})(:\d+)?(/[^\s]*)?$", v)
    if not m:
        raise ValueError("الرابط لازم يبدأ بـ / (صفحة في الموقع) أو https://")
    return v


class AnnouncementBar(BaseModel):
    """The scrolling bar at the top of every storefront page."""
    model_config = ConfigDict(extra="forbid")
    enabled: bool = True
    text_ar: Optional[str] = Field("أهلاً بكم في EcoBel", max_length=_ANNOUNCEMENT_TEXT_MAX)
    text_en: Optional[str] = Field(None, max_length=_ANNOUNCEMENT_TEXT_MAX)
    scrolling: bool = True
    # "auto": Arabic moves toward the left edge's opposite (enters where Arabic
    # reading starts) and English the other way; "right"/"left" force it.
    direction: Literal["auto", "right", "left"] = "auto"
    speed: Literal["slow", "normal", "fast"] = "normal"
    visibility: Literal["all", "desktop", "mobile"] = "all"
    theme: Literal["default", "brand", "light", "accent"] = "default"
    link_url: Optional[str] = None

    _texts = field_validator("text_ar", "text_en", mode="before")(_plain_text)
    _link = field_validator("link_url", mode="before")(_safe_link)

    @property
    def has_text(self) -> bool:
        return bool((self.text_ar or "").strip() or (self.text_en or "").strip())
