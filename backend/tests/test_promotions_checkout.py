"""Promotions through the real endpoints — cart quote, checkout, order
editing and cancellation, the public offers list and product badges — on a
throwaway SQLite DB (never the shared development database):

    cd backend && python -m pytest -q tests/test_promotions_checkout.py

Every offer here is restricted to this file's own products and removed
afterwards, so other test modules' carts are unaffected."""
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

from datetime import datetime, timedelta, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
CITY, FAR = "بورسعيد-pm", "أسوان-pm"
NOW = datetime.now(timezone.utc)


@pytest.fixture(scope="module", autouse=True)
def seed():
    limiter.enabled = False
    db = SessionLocal()
    db.add_all([models.Category(id="pm_skin", name="بشرة pm"), models.Category(id="pm_hair", name="شعر pm")])
    db.add_all([
        models.Product(id="pm_a", name="Serum", category_id="pm_skin", sale_price=250, quantity=50),
        models.Product(id="pm_b", name="Cream", category_id="pm_skin", sale_price=300, quantity=50),
        models.Product(id="pm_h", name="Shampoo", category_id="pm_hair", sale_price=200, quantity=50),
        models.Product(id="pm_g", name="Gift mask", category_id="pm_hair", sale_price=80, quantity=1),
    ])
    db.add_all([models.ShippingRate(city=CITY, fee=45), models.ShippingRate(city=FAR, fee=90)])
    db.add(models.Coupon(code="PM10", discount_type=models.CouponDiscountType.percentage, discount_value=10))
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(models.PromotionTarget).delete()
    db.query(models.Promotion).delete()
    db.commit()
    db.close()
    limiter.enabled = True


@pytest.fixture(autouse=True)
def clean_promotions():
    yield
    db = SessionLocal()
    db.query(models.PromotionTarget).delete()
    db.query(models.Promotion).delete()
    db.commit()
    db.close()


def promo(type_, config, *, products=(), categories=(), rewards=(), **kw):
    db = SessionLocal()
    kw.setdefault("status", "active")
    kw.setdefault("name", f"عرض {type_}")
    p = models.Promotion(type=type_, config=config, **kw)
    p.targets = ([models.PromotionTarget(role="eligible", product_id=x) for x in products]
                 + [models.PromotionTarget(role="eligible", category_id=x) for x in categories]
                 + [models.PromotionTarget(role="reward", product_id=x) for x in rewards])
    db.add(p)
    db.commit()
    pid = p.id
    db.close()
    return pid


def get(pid):
    db = SessionLocal()
    try:
        return db.get(models.Promotion, pid).used_count
    finally:
        db.close()


def quote(items, **extra):
    res = client.post("/cart/quote", json={"items": items, **extra})
    assert res.status_code == 200, res.text
    return res.json()


def order(items, phone="01011112222", **extra):
    payload = {"customer_name": "سارة محمود علي", "customer_phone": phone, "city": CITY,
               "shipping_address": "شارع النصر، عمارة 7", "items": items, **extra}
    return client.post("/orders/", json=payload)


def items(**qty):
    return [{"product_id": f"pm_{k}", "quantity": v} for k, v in qty.items()]


def snapshots(order_id):
    db = SessionLocal()
    try:
        return db.query(models.OrderPromotion).filter_by(order_id=order_id).all()
    finally:
        db.close()


def test_bundle_quote_and_order_agree_and_order_keeps_a_snapshot():
    pid = promo("bundle", {"bundle_quantity": 3, "bundle_price": 600}, categories=["pm_skin"], badge_text="3 بـ 600")
    bundle = {"promotion_id": pid, "quantity": 1, "items": [{"product_id": "pm_a", "quantity": 3}]}
    q = quote(items(a=1), city=CITY, bundles=[bundle])
    assert q["promotion_discount"] == 150 and q["total"] == 1000 - 150 + 45
    assert q["promotions"][0]["detail"]["bundles"] == 1
    assert q["bundles"][0]["total"] == 600 and q["bundles"][0]["discount"] == 150 and q["bundles"][0]["issue"] is None
    line = q["lines"][0]  # the loose 4th unit: full price, but it shows the badge
    assert line["promotion_discount"] == 0 and line["product"]["promotions"][0]["badge_text"] == "3 بـ 600"

    res = order(items(a=1), bundles=[bundle])
    assert res.status_code == 201, res.text
    o = res.json()
    assert o["promotion_discount"] == 150 and o["total_amount"] == q["total"]
    assert o["applied_promotions"][0]["promotion_id"] == pid
    assert o["items"] == [{"product_id": "pm_a", "product_name": "Serum", "unit_price": 250, "quantity": 4, "line_total": 1000}]
    assert o["bundles"][0]["items"][0]["quantity"] == 3 and o["bundles"][0]["price"] == 600
    snap = snapshots(o["id"])[0]
    assert snap.discount == 150 and snap.terms["config"]["bundle_price"] == 600
    assert snap.details["units"] == {"pm_a": 3} and snap.details["order_subtotal"] == 1000
    assert get(pid) == 1


def test_client_cannot_send_its_own_prices_or_discounts():
    promo("percentage", {"percent": 10}, products=["pm_b"])
    tampered = [{"product_id": "pm_b", "quantity": 1, "unit_price": 1, "discount": 299, "line_total": 1}]
    res = order(tampered, total_amount=1, promotion_discount=300, discount_amount=300, shipping_fee=0)
    assert res.status_code == 201
    o = res.json()
    assert o["subtotal"] == 300 and o["promotion_discount"] == 30 and o["shipping_fee"] == 45 and o["total_amount"] == 315


def test_inactive_draft_scheduled_and_expired_offers_do_nothing_and_are_not_listed():
    promo("percentage", {"percent": 50}, products=["pm_a"], status="draft")
    promo("percentage", {"percent": 50}, products=["pm_a"], status="inactive")
    promo("percentage", {"percent": 50}, products=["pm_a"], starts_at=NOW + timedelta(days=1))
    promo("percentage", {"percent": 50}, products=["pm_a"], ends_at=NOW - timedelta(seconds=1))
    q = quote(items(a=1))
    assert q["promotion_discount"] == 0 and q["promotions"] == [] and q["promotion_hints"] == []
    assert q["lines"][0]["product"]["promotions"] == []
    assert client.get("/promotions").json() == []


def test_public_list_badges_and_qualifying_products_filter():
    pid = promo("buy_x_get_y", {"buy_quantity": 2, "get_quantity": 1}, products=["pm_h"], rewards=["pm_g"], badge_text="هدية")
    listed = client.get("/promotions").json()
    assert [p["id"] for p in listed] == [pid] and listed[0]["reward_product_ids"] == ["pm_g"]
    ids = {p["id"] for p in client.get("/catalog/products", params={"promotion": pid, "limit": 100}).json()["items"]}
    assert ids == {"pm_h", "pm_g"}
    gift = client.get("/catalog/products/pm_g").json()["promotions"]
    assert gift[0]["role"] == "reward"
    assert client.get("/catalog/products", params={"promotion": "nope"}).json()["total"] == 0


def test_buy_x_get_y_gift_is_free_and_stock_checked():
    pid = promo("buy_x_get_y", {"buy_quantity": 2, "get_quantity": 1}, products=["pm_h"], rewards=["pm_g"])
    q = quote(items(h=2))
    assert q["promotion_discount"] == 0 and "الهدية" in q["promotion_hints"][0]["reason"]
    q = quote(items(h=2, g=1), city=CITY)
    assert q["promotion_discount"] == 80 and [l["free_units"] for l in q["lines"]] == [0, 1]
    # only 1 gift in stock: asking for 2 is refused like any line, never fulfilled
    q2 = quote(items(h=4, g=2))
    assert q2["has_issues"] and q2["promotion_discount"] == 0
    assert order(items(h=4, g=2)).status_code == 409
    o = order(items(h=2, g=1)).json()
    assert o["promotion_discount"] == 80 and o["total_amount"] == 400 + 45
    assert get(pid) == 1


def test_free_shipping_offer_uses_the_city_fee_and_cities():
    promo("free_shipping", {"cities": [CITY]}, products=["pm_b"], min_subtotal=300)
    q = quote(items(b=1), city=CITY)
    assert q["shipping_fee"] == 0 and q["shipping_discount"] == 45 and q["total"] == 300
    q = quote(items(b=1), city=FAR)
    assert q["shipping_fee"] == 90 and "متاح" in q["promotion_hints"][0]["reason"]
    q = quote(items(h=1), city=CITY)  # no eligible product: offer not even mentioned
    assert q["shipping_fee"] == 45 and q["promotion_hints"] == []
    o = order(items(b=1)).json()
    assert o["shipping_fee"] == 0 and o["total_amount"] == 300
    assert o["applied_promotions"][0]["shipping_discount"] == 45


def test_coupon_applies_after_offers():
    promo("fixed_amount", {"amount": 100}, products=["pm_b"])
    q = quote(items(b=1), coupon_code="PM10", city=CITY)
    assert q["promotion_discount"] == 100 and q["discount"] == 20 and q["total"] == 300 - 100 - 20 + 45
    assert q["total_savings"] == 120


def test_fixed_amount_never_makes_the_total_negative():
    promo("fixed_amount", {"amount": 5000}, products=["pm_h"])
    q = quote(items(h=1), city=CITY)
    assert q["promotion_discount"] == 200 and q["total"] == 45


def test_minimum_subtotal_hint_updates_with_the_cart():
    promo("percentage", {"percent": 10}, categories=["pm_skin"], min_subtotal=500)
    q = quote(items(a=1))
    assert q["promotion_discount"] == 0 and "250" in q["promotion_hints"][0]["reason"]
    assert quote(items(a=2))["promotion_discount"] == 50


def test_global_usage_limit():
    pid = promo("percentage", {"percent": 10}, products=["pm_b"], usage_limit=1)
    assert order(items(b=1), phone="01020000001").json()["promotion_discount"] == 30
    second = order(items(b=1), phone="01020000002").json()
    assert second["promotion_discount"] == 0 and second["applied_promotions"] == []
    assert get(pid) == 1
    assert quote(items(b=1))["promotion_hints"] == []  # used up: no longer advertised


def test_per_customer_limit_and_cancellation_releases_the_use():
    pid = promo("percentage", {"percent": 10}, products=["pm_b"], per_customer_limit=1)
    reg = client.post("/account/register", json={"name": "ريم عادل سعيد", "phone": "01030000003", "password": "secret123"})
    auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    first = client.post("/orders/", headers=auth, json={"customer_name": "ريم عادل سعيد", "customer_phone": "01030000003", "city": CITY,
                                                          "shipping_address": "شارع البحر 12", "items": items(b=1)}).json()
    assert first["promotion_discount"] == 30
    # the quote knows this shopper already used it
    q = client.post("/cart/quote", headers=auth, json={"items": items(b=1)}).json()
    assert q["promotion_discount"] == 0
    again = client.post("/orders/", headers=auth, json={"customer_name": "ريم عادل سعيد", "customer_phone": "01030000003", "city": CITY,
                                                          "shipping_address": "شارع البحر 12", "items": items(b=1)}).json()
    assert again["promotion_discount"] == 0
    assert get(pid) == 1
    assert client.delete(f"/orders/{first['id']}", headers=auth).status_code == 200
    assert get(pid) == 0
    assert client.post("/cart/quote", headers=auth, json={"items": items(b=1)}).json()["promotion_discount"] == 30
    assert snapshots(first["id"])  # history stays with the cancelled order


def test_guest_per_customer_limit_follows_the_phone():
    promo("percentage", {"percent": 10}, products=["pm_b"], per_customer_limit=1)
    assert order(items(b=1), phone="01040000004").json()["promotion_discount"] == 30
    assert order(items(b=1), phone="01040000004").json()["promotion_discount"] == 0
    assert order(items(b=1), phone="01040000005").json()["promotion_discount"] == 30


def test_editing_an_order_keeps_a_held_offer_and_releases_one_it_loses():
    pid = promo("percentage", {"percent": 10}, products=["pm_b"], usage_limit=1)
    reg = client.post("/account/register", json={"name": "نور حسن علي", "phone": "01050000006", "password": "secret123"})
    auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    o = client.post("/orders/", headers=auth, json={"customer_name": "نور حسن علي", "customer_phone": "01050000006", "city": CITY,
                                                      "shipping_address": "شارع الجمهورية 3", "items": items(b=1)}).json()
    assert o["promotion_discount"] == 30 and get(pid) == 1
    db = SessionLocal()
    db.get(models.Promotion, pid).status = "inactive"  # ended since — the order keeps what it got
    db.commit()
    db.close()
    edited = client.patch(f"/orders/{o['id']}", headers=auth, json={"items": items(b=2)}).json()
    assert edited["promotion_discount"] == 60 and get(pid) == 1
    edited = client.patch(f"/orders/{o['id']}", headers=auth, json={"items": items(h=1)}).json()
    assert edited["promotion_discount"] == 0 and edited["applied_promotions"] == [] and get(pid) == 0
    assert snapshots(o["id"]) == []


def test_priority_and_combination_between_offers():
    promo("percentage", {"percent": 50}, products=["pm_a"], priority=1, name="نص السعر")
    promo("percentage", {"percent": 10}, products=["pm_a"], priority=9, name="عشرة في المية")
    q = quote(items(a=1))
    assert [p["name"] for p in q["promotions"]] == ["عشرة في المية"] and q["promotion_discount"] == 25
    assert "ما بيتجمعش" in q["promotion_hints"][0]["reason"]


# ---------------------------------------------------------------- "offers only" (any_offer)
def _listed(**params):
    res = client.get("/catalog/products", params={"limit": 100, **params})
    assert res.status_code == 200, res.text
    return [p["id"] for p in res.json()["items"]]


def test_offers_only_lists_sale_prices_and_products_in_running_cart_offers():
    # (pm_g's stock is used up by earlier tests in this module — listings skip
    # unavailable products — so the gift here is the well-stocked pm_h)
    promo("bundle", {"mode": "combination", "bundle_price": 400, "bundle_quantity": 2}, products=["pm_a"])
    promo("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1}, products=["pm_a"], rewards=["pm_h"])
    db = SessionLocal()
    db.add(models.Offer(id="pm_sale", product_id="pm_b", title="خصم", offer_price=240))
    db.commit()
    db.close()
    try:
        ids = _listed(any_offer="true")
        assert {"pm_a", "pm_h", "pm_b"} <= set(ids)  # in a bundle, the gift (reward only), a sale price
        # on_offer keeps meaning "sale price" (the homepage sale-price section)
        legacy = _listed(on_offer="true")
        assert "pm_b" in legacy and not {"pm_a", "pm_h"} & set(legacy)
        # other filters and sorting still apply on top
        asc = _listed(any_offer="true", category_id="pm_skin", sort="price_asc")
        desc = _listed(any_offer="true", category_id="pm_skin", sort="price_desc")
        assert [i for i in asc if i.startswith("pm_")] == ["pm_b", "pm_a"]  # 240 (sale price) before 250
        assert [i for i in desc if i.startswith("pm_")] == ["pm_a", "pm_b"]
    finally:
        db = SessionLocal()
        db.query(models.Offer).filter_by(id="pm_sale").delete()
        db.commit()
        db.close()


def test_offers_only_ignores_inactive_expired_and_all_product_offers():
    promo("percentage", {"percent": 10}, products=["pm_h"], status="draft")
    promo("percentage", {"percent": 10}, products=["pm_h"], status="inactive")
    promo("percentage", {"percent": 10}, products=["pm_h"], ends_at=NOW - timedelta(seconds=1))
    promo("percentage", {"percent": 10}, products=["pm_h"], starts_at=NOW + timedelta(days=1))
    promo("percentage", {"percent": 5})  # open to every product: not "on offer" each
    ids = _listed(any_offer="true")
    assert not {"pm_a", "pm_b", "pm_h", "pm_g"} & set(ids)
