"""Bundles added to the cart as ONE item — the public bundle offer, the
quote, checkout, editing and cancelling — on a throwaway SQLite DB (never the
shared development database):

    cd backend && python -m pytest -q tests/test_promotions_bundle_cart.py

Offers here are restricted to this file's products and removed after each
test, so other test modules are unaffected."""
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
CITY = "دمياط-bc"


@pytest.fixture(scope="module", autouse=True)
def seed():
    limiter.enabled = False
    db = SessionLocal()
    db.add_all([models.Category(id="bc_skin", name="بشرة bc"), models.Category(id="bc_hair", name="شعر bc")])
    db.add_all([
        models.Product(id="bc_cleanser", name="Cleanser", category_id="bc_skin", sale_price=150, quantity=40),
        models.Product(id="bc_serum", name="Serum", category_id="bc_skin", sale_price=400, quantity=40),
        models.Product(id="bc_cream", name="Cream", category_id="bc_skin", sale_price=300, quantity=40),
        models.Product(id="bc_rare", name="Rare oil", category_id="bc_skin", sale_price=350, quantity=1),
        models.Product(id="bc_off", name="Retired", category_id="bc_skin", sale_price=100, quantity=10, is_active=False),
        models.Product(id="bc_shampoo", name="Shampoo", category_id="bc_hair", sale_price=200, quantity=40),
    ])
    db.add(models.ShippingRate(city=CITY, fee=40))
    db.commit()
    db.close()
    yield
    limiter.enabled = True


@pytest.fixture(autouse=True)
def clean():
    yield
    db = SessionLocal()
    db.query(models.PromotionTarget).delete()
    db.query(models.Promotion).delete()
    db.commit()
    db.close()


def fixed(contents: dict, price: float, **kw) -> str:
    """A FIXED bundle: exact products and units per bundle."""
    return _promo({"mode": "combination", "bundle_price": price, "bundle_quantity": sum(contents.values()), **kw.pop("config", {})},
                  [models.PromotionTarget(role="eligible", product_id=p, quantity=n) for p, n in contents.items()], **kw)


def choose(size: int, price: float, *, categories=(), products=(), **kw) -> str:
    """A CHOOSE-YOUR-OWN bundle: any `size` eligible units."""
    targets = ([models.PromotionTarget(role="eligible", category_id=c) for c in categories]
               + [models.PromotionTarget(role="eligible", product_id=p) for p in products])
    return _promo({"mode": "any", "bundle_quantity": size, "bundle_price": price, **kw.pop("config", {})}, targets, **kw)


def _promo(config, targets, **kw):
    db = SessionLocal()
    kw.setdefault("status", "active")
    p = models.Promotion(type="bundle", name=kw.pop("name", "باقة"), config=config, **kw)
    p.targets = targets
    db.add(p)
    db.commit()
    pid = p.id
    db.close()
    return pid


def B(pid, contents: dict, quantity=1, **extra):
    return {"promotion_id": pid, "quantity": quantity, "items": [{"product_id": k, "quantity": v, **extra} for k, v in contents.items()]}


def quote(bundles=(), items=(), **extra):
    res = client.post("/cart/quote", json={"items": list(items), "bundles": list(bundles), **extra})
    assert res.status_code == 200, res.text
    return res.json()


def order(bundles=(), items=(), phone="01077770001", **extra):
    return client.post("/orders/", json={"customer_name": "منى علي حسن", "customer_phone": phone, "city": CITY,
                                         "shipping_address": "شارع البحر، عمارة 9", "items": list(items), "bundles": list(bundles), **extra})


def stock(pid):
    db = SessionLocal()
    try:
        return db.get(models.Product, pid).quantity
    finally:
        db.close()


def used(pid):
    db = SessionLocal()
    try:
        return db.get(models.Promotion, pid).used_count
    finally:
        db.close()


# ---------------------------------------------------------------- the offer card
def test_bundle_offer_card_lists_fixed_contents_price_and_saving():
    pid = fixed({"bc_cleanser": 2, "bc_serum": 1}, 600, name="روتين النضارة")
    card = client.get(f"/promotions/{pid}/bundle").json()
    assert card["fixed"] and card["bundle_price"] == 600 and card["bundle_quantity"] == 3
    assert {(p["product"]["id"], p["quantity"]) for p in card["products"]} == {("bc_cleanser", 2), ("bc_serum", 1)}
    assert card["regular_total"] == 700 and card["savings"] == 100 and card["available"]


def test_choose_bundle_card_lists_only_sellable_eligible_products():
    pid = choose(3, 600, categories=["bc_skin"])
    card = client.get(f"/promotions/{pid}/bundle").json()
    ids = {p["product"]["id"] for p in card["products"]}
    assert not card["fixed"] and card["bundle_quantity"] == 3 and "bc_off" not in ids and "bc_shampoo" not in ids
    assert {"bc_cleanser", "bc_serum", "bc_cream"} <= ids


def test_bundle_card_404_for_unknown_ended_or_non_bundle_offers():
    assert client.get("/promotions/nope/bundle").status_code == 404
    db = SessionLocal()
    p = models.Promotion(type="percentage", status="active", name="x", config={"percent": 10})
    db.add(p)
    db.commit()
    other = p.id
    db.close()
    assert client.get(f"/promotions/{other}/bundle").status_code == 404
    draft = fixed({"bc_cleanser": 1, "bc_serum": 1}, 400, status="draft")
    assert client.get(f"/promotions/{draft}/bundle").status_code == 404


# ---------------------------------------------------------------- one-click fixed bundle
def test_fixed_bundle_is_one_cart_item_and_one_order_with_accurate_stock():
    pid = fixed({"bc_cleanser": 2, "bc_serum": 1}, 600)
    q = quote([B(pid, {"bc_cleanser": 2, "bc_serum": 1})], city=CITY)
    assert q["lines"] == [] and len(q["bundles"]) == 1
    b = q["bundles"][0]
    assert b["fixed"] and b["regular_total"] == 700 and b["total"] == 600 and b["discount"] == 100 and b["issue"] is None
    assert q["subtotal"] == 700 and q["promotion_discount"] == 100 and q["total"] == 600 + 40 and not q["has_issues"]
    before = stock("bc_cleanser"), stock("bc_serum")
    res = order([B(pid, {"bc_cleanser": 2, "bc_serum": 1})])
    assert res.status_code == 201, res.text
    o = res.json()
    assert o["total_amount"] == 640 and o["promotion_discount"] == 100
    assert sorted((i["product_id"], i["quantity"]) for i in o["items"]) == [("bc_cleanser", 2), ("bc_serum", 1)]
    assert o["bundles"][0]["quantity"] == 1 and o["bundles"][0]["price"] == 600
    assert (stock("bc_cleanser"), stock("bc_serum")) == (before[0] - 2, before[1] - 1)
    assert used(pid) == 1


def test_tampered_bundle_prices_are_ignored_and_contents_are_checked():
    pid = fixed({"bc_cleanser": 2, "bc_serum": 1}, 600)
    tampered = B(pid, {"bc_cleanser": 2, "bc_serum": 1}, unit_price=1, price=1)
    tampered.update(bundle_price=1, total=1, discount=999)
    o = order([tampered], phone="01077770002").json()
    assert o["total_amount"] == 640 and o["promotion_discount"] == 100
    # changing a fixed bundle's contents is not the bundle any more
    q = quote([B(pid, {"bc_cleanser": 1, "bc_serum": 1})])
    assert q["has_issues"] and "محتوى الباقة" in q["bundles"][0]["issue"] and q["promotion_discount"] == 0
    res = order([B(pid, {"bc_cleanser": 1, "bc_serum": 1})], phone="01077770003")
    assert res.status_code == 409 and "محتوى الباقة" in res.json()["detail"]


# ---------------------------------------------------------------- choose-your-own
def test_choose_bundle_needs_the_configured_number_of_valid_products():
    pid = choose(3, 600, categories=["bc_skin"])
    q = quote([B(pid, {"bc_cleanser": 1, "bc_serum": 1, "bc_cream": 1})])
    assert q["bundles"][0]["total"] == 600 and q["bundles"][0]["discount"] == 250 and not q["has_issues"]
    for contents, needle in (({"bc_cleanser": 1, "bc_serum": 1}, "3 منتجات"),
                             ({"bc_cleanser": 1, "bc_serum": 1, "bc_shampoo": 1}, "مش من منتجات العرض")):
        q = quote([B(pid, contents)])
        assert q["has_issues"] and needle in q["bundles"][0]["issue"]
        assert order([B(pid, contents)], phone="01077770004").status_code == 409


# ---------------------------------------------------------------- stock
def test_out_of_stock_or_unavailable_components_block_checkout():
    pid = fixed({"bc_rare": 2, "bc_serum": 1}, 800)
    q = quote([B(pid, {"bc_rare": 2, "bc_serum": 1})])
    assert q["has_issues"] and "Rare oil" in q["bundles"][0]["issue"]
    assert order([B(pid, {"bc_rare": 2, "bc_serum": 1})], phone="01077770005").status_code == 409
    # a loose line and a bundle share the stock of a product
    one = fixed({"bc_rare": 1, "bc_serum": 1}, 600)
    q = quote([B(one, {"bc_rare": 1, "bc_serum": 1})], items=[{"product_id": "bc_rare", "quantity": 1}])
    assert q["has_issues"] and q["lines"][0]["issue"] == "insufficient_stock" and q["bundles"][0]["issue"]
    assert stock("bc_rare") == 1
    retired = fixed({"bc_off": 1, "bc_serum": 1}, 300)
    q = quote([B(retired, {"bc_off": 1, "bc_serum": 1})])
    assert q["has_issues"] and "مش متاح" in q["bundles"][0]["issue"]
    assert order([B(retired, {"bc_off": 1, "bc_serum": 1})], phone="01077770006").status_code == 409


# ---------------------------------------------------------------- several bundles
def test_multiple_bundles_only_when_allowed():
    many = fixed({"bc_cleanser": 1, "bc_serum": 1}, 450, config={"allow_multiple": True, "max_bundles": 2})
    q = quote([B(many, {"bc_cleanser": 1, "bc_serum": 1}, quantity=2)])
    assert q["bundles"][0]["total"] == 900 and q["bundles"][0]["discount"] == 200
    q = quote([B(many, {"bc_cleanser": 1, "bc_serum": 1}, quantity=3)])
    assert q["has_issues"] and "أقصى عدد" in q["bundles"][0]["issue"]
    once = fixed({"bc_cream": 1, "bc_serum": 1}, 600, config={"allow_multiple": False})
    res = order([B(once, {"bc_cream": 1, "bc_serum": 1}, quantity=2)], phone="01077770007")
    assert res.status_code == 409 and "أقصى عدد" in res.json()["detail"]
    res = order([B(many, {"bc_cleanser": 1, "bc_serum": 1}, quantity=2)], phone="01077770008")
    assert res.status_code == 201 and res.json()["promotion_discount"] == 200
    assert used(many) == 1  # one order = one use, however many bundles


def test_loose_items_alone_never_get_the_bundle_price():
    pid = fixed({"bc_cleanser": 1, "bc_serum": 1}, 450)
    q = quote(items=[{"product_id": "bc_cleanser", "quantity": 1}, {"product_id": "bc_serum", "quantity": 1}])
    assert q["promotion_discount"] == 0 and q["bundles"] == []
    assert any("أضيفي الباقة كاملة" in h["reason"] for h in q["promotion_hints"])
    assert pid


# ---------------------------------------------------------------- edit & cancel
@pytest.fixture()
def account():
    import uuid
    phone = "0109" + str(uuid.uuid4().int)[:7]
    res = client.post("/account/register", json={"name": "سارة أحمد علي", "phone": phone, "password": "secret123"})
    assert res.status_code == 201, res.text
    return phone, {"Authorization": f"Bearer {res.json()['access_token']}"}


def _place(auth, phone, bundles, items=()):
    res = client.post("/orders/", headers=auth, json={"customer_name": "سارة أحمد علي", "customer_phone": phone, "city": CITY,
                                                      "shipping_address": "شارع البحر، عمارة 9", "items": list(items), "bundles": bundles})
    assert res.status_code == 201, res.text
    return res.json()


def test_editing_keeps_bundles_whole_and_removing_one_removes_all_of_it(account):
    phone, auth = account
    pid = fixed({"bc_cleanser": 2, "bc_serum": 1}, 600)
    o = _place(auth, phone, [B(pid, {"bc_cleanser": 2, "bc_serum": 1})], items=[{"product_id": "bc_cream", "quantity": 1}])
    stock_before = stock("bc_cleanser")
    # changing only the loose items keeps the bundle exactly as it was
    edited = client.patch(f"/orders/{o['id']}", headers=auth, json={"items": [{"product_id": "bc_cream", "quantity": 2}]}).json()
    assert edited["promotion_discount"] == 100 and edited["bundles"][0]["items"] and stock("bc_cleanser") == stock_before
    assert sorted((i["product_id"], i["quantity"]) for i in edited["items"]) == [("bc_cleanser", 2), ("bc_cream", 2), ("bc_serum", 1)]
    # removing the bundle removes all its products and gives the offer use back
    edited = client.patch(f"/orders/{o['id']}", headers=auth, json={"items": [{"product_id": "bc_cream", "quantity": 2}], "bundles": []}).json()
    assert edited["bundles"] == [] and edited["promotion_discount"] == 0
    assert [(i["product_id"], i["quantity"]) for i in edited["items"]] == [("bc_cream", 2)]
    assert stock("bc_cleanser") == stock_before + 2 and used(pid) == 0
    # an order can't end up empty
    res = client.patch(f"/orders/{o['id']}", headers=auth, json={"items": [], "bundles": []})
    assert res.status_code == 400


def test_cancelling_a_bundle_order_restocks_every_component(account):
    phone, auth = account
    pid = fixed({"bc_cleanser": 2, "bc_serum": 1}, 600)
    before = stock("bc_cleanser"), stock("bc_serum")
    o = _place(auth, phone, [B(pid, {"bc_cleanser": 2, "bc_serum": 1}, quantity=1)])
    assert client.delete(f"/orders/{o['id']}", headers=auth).status_code == 200
    assert (stock("bc_cleanser"), stock("bc_serum")) == before and used(pid) == 0


def test_an_empty_order_is_refused():
    assert order().status_code == 422
