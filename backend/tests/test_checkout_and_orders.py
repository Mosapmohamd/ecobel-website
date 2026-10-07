"""Checkout totals, order creation, editing and cancellation — run against a
throwaway SQLite DB (never the shared development database):

    cd backend && python -m pytest -q
"""
import os
import sys
import tempfile

# Alongside the catalog tests the app is already bound to that file's
# throwaway DB (ids below don't collide with its data); run alone, this
# file gets its own.
if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

# The real schema is migrated by ecobel-accounting-system; for this
# throwaway SQLite DB the models' tables are enough.
models.Base.metadata.create_all(bind=engine)
from app.rate_limit import limiter  # noqa: E402

client = TestClient(app)
CITY = "الجيزة"  # fee 30


@pytest.fixture(scope="module", autouse=True)
def seed():
    limiter.enabled = False  # these tests place more orders than 5/minute
    db = SessionLocal()
    db.add(models.Category(id="k_cat", name="فئة الاختبار"))
    db.add_all([
        models.Product(id="k1", name="Cleanser", category_id="k_cat", sale_price=200, quantity=10),
        models.Product(id="k2", name="Toner", category_id="k_cat", sale_price=400, quantity=2),
        models.Product(id="k3", name="Retired", category_id="k_cat", sale_price=100, quantity=5, is_active=False),
    ])
    db.add_all([
        models.ShippingRate(city=CITY, fee=30),
        models.ShippingRate(city="مدينة موقوفة", fee=10, is_active=False),
    ])
    db.add_all([
        models.Coupon(code="K10", discount_type=models.CouponDiscountType.percentage, discount_value=10),
        models.Coupon(code="KMIN", discount_type=models.CouponDiscountType.fixed, discount_value=50, min_order_amount=500),
        models.Coupon(code="KONCE", discount_type=models.CouponDiscountType.fixed, discount_value=20, max_uses=1),
        models.Coupon(code="KOFF", discount_type=models.CouponDiscountType.fixed, discount_value=20, is_active=False),
    ])
    db.commit()
    db.close()
    yield
    limiter.enabled = True


def quote(items, **extra):
    return client.post("/cart/quote", json={"items": items, **extra}).json()


def order_payload(items, **extra):
    return {
        "customer_name": "منى علي حسن",
        "customer_phone": "01099998888",
        "city": CITY,
        "shipping_address": "شارع الهرم، عمارة 4",
        "items": items,
        **extra,
    }


def coupon_uses(code):
    db = SessionLocal()
    try:
        return db.query(models.Coupon).filter_by(code=code).one().used_count
    finally:
        db.close()


def stock(pid):
    db = SessionLocal()
    try:
        return db.get(models.Product, pid).quantity
    finally:
        db.close()


@pytest.fixture(scope="module")
def token():
    res = client.post("/account/register", json={"name": "هبة سامي فؤاد", "phone": "01055554444", "password": "secret123"})
    assert res.status_code == 201, res.text
    return res.json()["access_token"]


def test_quote_without_city_has_no_shipping_yet():
    q = quote([{"product_id": "k1", "quantity": 1}])
    assert q["subtotal"] == 200 and q["shipping_fee"] is None and q["total"] == 200
    assert q["free_shipping_threshold"] == 1000


def test_quote_adds_city_fee_and_coupon_like_checkout():
    q = quote([{"product_id": "k1", "quantity": 2}], city=CITY, coupon_code="k10")
    assert q["coupon"] == {"code": "K10", "valid": True, "reason": None}
    assert q["discount"] == 40 and q["shipping_fee"] == 30 and q["total"] == 400 - 40 + 30


def test_quote_explains_rejected_coupons_and_cities():
    q = quote([{"product_id": "k1", "quantity": 1}], city="مدينة موقوفة", coupon_code="KMIN")
    assert q["coupon"]["valid"] is False and "الحد الأدنى" in q["coupon"]["reason"]
    assert q["discount"] == 0 and q["shipping_fee"] is None and q["city_error"]
    assert quote([{"product_id": "k1", "quantity": 1}], coupon_code="KOFF")["coupon"]["valid"] is False


def test_free_shipping_after_discount_threshold():
    q = quote([{"product_id": "k1", "quantity": 5}, {"product_id": "k2", "quantity": 1}], city=CITY)
    assert q["subtotal"] == 1400 and q["shipping_fee"] == 0 and q["total"] == 1400


def test_order_total_equals_quote_total():
    items = [{"product_id": "k1", "quantity": 2}]
    q = quote(items, city=CITY, coupon_code="K10")
    res = client.post("/orders/", json=order_payload(items, coupon_code="K10"))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["total_amount"] == q["total"] and body["discount_amount"] == q["discount"]
    assert coupon_uses("K10") == 1


def test_order_rejects_undeliverable_city_and_invalid_coupon():
    items = [{"product_id": "k1", "quantity": 1}]
    res = client.post("/orders/", json=order_payload(items, city="مدينة مش موجودة"))
    assert res.status_code == 400 and "التوصيل" in res.json()["detail"]
    res = client.post("/orders/", json=order_payload(items, coupon_code="KOFF"))
    assert res.status_code == 400 and "الكوبون" in res.json()["detail"]


def test_order_rejects_unavailable_or_insufficient_stock_without_leaking_ids():
    res = client.post("/orders/", json=order_payload([{"product_id": "k3", "quantity": 1}]))
    assert res.status_code == 409 and "k3" not in res.json()["detail"]
    # Two lines of the same product are checked against their sum (2 in stock).
    before = stock("k2")
    res = client.post("/orders/", json=order_payload([{"product_id": "k2", "quantity": 2}, {"product_id": "k2", "quantity": 1}]))
    assert res.status_code == 409 and "Toner" in res.json()["detail"]
    assert stock("k2") == before


def test_validation_errors_come_back_as_one_arabic_sentence():
    res = client.post("/orders/", json=order_payload([{"product_id": "k1", "quantity": 1}], customer_name="Mona"))
    assert res.status_code == 422 and res.json()["detail"].startswith("الاسم لازم يكون ثلاثي")
    res = client.post("/orders/", json=order_payload([{"product_id": "k1", "quantity": 1}], shipping_address="x"))
    assert res.status_code == 422 and isinstance(res.json()["detail"], str)


def test_single_use_coupon_is_used_once_and_freed_by_cancellation(token):
    auth = {"Authorization": f"Bearer {token}"}
    items = [{"product_id": "k1", "quantity": 1}]
    first = client.post("/orders/", json=order_payload(items, coupon_code="KONCE", customer_phone="01055554444"), headers=auth)
    assert first.status_code == 201, first.text
    again = client.post("/orders/", json=order_payload(items, coupon_code="KONCE"))
    assert again.status_code == 400

    stock_before = stock("k1")
    res = client.delete(f"/orders/{first.json()['id']}", headers=auth)
    assert res.status_code == 200 and res.json()["status"] == "cancelled"
    assert stock("k1") == stock_before + 1 and coupon_uses("KONCE") == 0
    # Cancelled orders are final for the customer.
    assert client.delete(f"/orders/{first.json()['id']}", headers=auth).status_code == 409


def test_edit_keeps_a_used_up_coupon_and_can_change_city(token):
    auth = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/orders/",
        json=order_payload([{"product_id": "k1", "quantity": 1}], coupon_code="KONCE", customer_phone="01055554444"),
        headers=auth,
    ).json()
    assert coupon_uses("KONCE") == 1  # now at its max — but this order already holds it

    res = client.patch(f"/orders/{created['id']}", json={"items": [{"product_id": "k1", "quantity": 3}]}, headers=auth)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["discount_amount"] == 20 and body["subtotal"] == 600 and body["total_amount"] == 600 - 20 + 30

    res = client.patch(
        f"/orders/{created['id']}",
        json={"items": [{"product_id": "k1", "quantity": 3}], "city": "مدينة موقوفة"},
        headers=auth,
    )
    assert res.status_code == 400
    assert coupon_uses("KONCE") == 1


def test_edit_releases_coupon_that_no_longer_qualifies(token):
    auth = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/orders/",
        json=order_payload([{"product_id": "k2", "quantity": 2}], coupon_code="KMIN", customer_phone="01055554444"),
        headers=auth,
    ).json()
    assert created["discount_amount"] == 50 and coupon_uses("KMIN") == 1
    res = client.patch(f"/orders/{created['id']}", json={"items": [{"product_id": "k2", "quantity": 1}]}, headers=auth)
    assert res.status_code == 200
    assert res.json()["discount_amount"] == 0 and coupon_uses("KMIN") == 0


def test_someone_elses_order_looks_missing(token):
    guest = client.post("/orders/", json=order_payload([{"product_id": "k1", "quantity": 1}], customer_phone="01077776666")).json()
    auth = {"Authorization": f"Bearer {token}"}
    assert client.delete(f"/orders/{guest['id']}", headers=auth).status_code == 404
    edit = {"items": [{"product_id": "k1", "quantity": 1}]}
    assert client.patch(f"/orders/{guest['id']}", json=edit, headers=auth).status_code == 404
