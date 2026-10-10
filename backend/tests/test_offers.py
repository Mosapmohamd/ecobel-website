"""Offers from the admin system, as the storefront sees them.

The shared schema has one kind of managed offer: a product price offer
(`offers`: product, title, offer_price, is_active, optional expires_at).
Only a *live* offer — active, not expired, cheaper than the product's
price, on a product the shop sells — is shown or charged, and it is shown
and charged the same everywhere: listings, the "on offer" filter, product
pages, routines, the cart quote and the order itself.
"""
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import checkout, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
NOW = datetime.now(timezone.utc)


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add(models.Category(id="of_cat", name="فئة العروض"))
    products = {
        "of_live": 200, "of_expired": 200, "of_paused": 200, "of_mispriced": 200,
        "of_future_end": 200, "of_plain": 100,
    }
    for pid, price in products.items():
        db.add(models.Product(id=pid, name=pid, category_id="of_cat", sale_price=price, quantity=10))
    db.add(models.Product(id="of_hidden", name="of_hidden", category_id="of_cat", sale_price=200, quantity=10, is_active=False))
    db.add(models.Product(id="of_soldout", name="of_soldout", category_id="of_cat", sale_price=200, quantity=0))
    db.add_all([
        models.Offer(id="o_live", product_id="of_live", title="عرض شغال", offer_price=150),
        models.Offer(id="o_expired", product_id="of_expired", title="عرض منتهي", offer_price=150, expires_at=NOW - timedelta(hours=1)),
        models.Offer(id="o_paused", product_id="of_paused", title="عرض موقوف", offer_price=150, is_active=False),
        # Price was lowered below the offer after it was created: no longer a discount.
        models.Offer(id="o_mispriced", product_id="of_mispriced", title="عرض أغلى", offer_price=250),
        models.Offer(id="o_future_end", product_id="of_future_end", title="لسه شغال", offer_price=180, expires_at=NOW + timedelta(days=2)),
        models.Offer(id="o_hidden", product_id="of_hidden", title="منتج مخفي", offer_price=150),
        models.Offer(id="o_soldout", product_id="of_soldout", title="منتج خلصان", offer_price=150),
    ])
    db.add(models.Routine(id="of_routine", name="روتين العروض"))
    db.flush()
    db.add_all([
        models.RoutineItem(routine_id="of_routine", product_id="of_live", position=0),
        models.RoutineItem(routine_id="of_routine", product_id="of_expired", position=1),
    ])
    db.add(models.ShippingRate(city="مدينة اختبار العروض", fee=50))
    db.commit()
    db.close()


LIVE = {"of_live": ("o_live", 150), "of_future_end": ("o_future_end", 180)}
NOT_LIVE = ["of_expired", "of_paused", "of_mispriced"]


def product(pid):
    return client.get(f"/catalog/products/{pid}").json()


@pytest.mark.parametrize("pid", list(LIVE))
def test_live_offer_is_shown_and_priced(pid):
    offer_id, price = LIVE[pid]
    p = product(pid)
    assert p["offer"]["id"] == offer_id and p["price"] == price and p["sale_price"] == 200
    assert p["offer"]["title"]  # the admin's own title reaches the product page


@pytest.mark.parametrize("pid", NOT_LIVE)
def test_expired_paused_or_mispriced_offers_are_never_presented(pid):
    p = product(pid)
    assert p["offer"] is None and p["price"] == p["sale_price"] == 200


def test_offers_on_products_the_shop_does_not_sell_are_not_presented():
    assert client.get("/catalog/products/of_hidden").status_code == 404
    listed = {p["id"] for p in client.get("/catalog/products?on_offer=true&limit=100").json()["items"]}
    assert "of_hidden" not in listed and "of_soldout" not in listed


def test_on_offer_filter_lists_exactly_the_live_offers():
    listed = {p["id"] for p in client.get("/catalog/products?on_offer=true&limit=100").json()["items"] if p["id"].startswith("of_")}
    assert listed == set(LIVE)


def test_routine_prices_each_item_like_the_cart():
    r = client.get("/catalog/routines/of_routine").json()
    prices = {i["product"]["id"]: i["price"] for i in r["items"]}
    assert prices == {"of_live": 150, "of_expired": 200}  # expired offer → regular price
    assert r["total"] == 350 and r["regular_total"] == 400 and r["savings"] == 50


def test_cart_and_order_charge_only_live_offers():
    items = [{"product_id": "of_live", "quantity": 2}, {"product_id": "of_expired", "quantity": 1},
             {"product_id": "of_plain", "quantity": 1}]
    q = client.post("/cart/quote", json={"items": items}).json()
    unit = {line["product_id"]: line["unit_price"] for line in q["lines"]}
    assert unit == {"of_live": 150, "of_expired": 200, "of_plain": 100}
    assert q["subtotal"] == 600 and q["regular_subtotal"] == 700 and q["savings"] == 100

    order = client.post("/orders/", json={
        "customer_name": "منى علي حسن", "customer_phone": "01055554444", "city": "مدينة اختبار العروض",
        "shipping_address": "شارع الهرم، عمارة 4", "items": items,
    })
    assert order.status_code == 201
    o = order.json()
    assert o["subtotal"] == 600 and o["discount_amount"] == 0 and o["total_amount"] == 600 + o["shipping_fee"]


def test_free_shipping_threshold_matches_storefront_copy():
    """The storefront advertises the free-shipping threshold in several
    places; checkout applies the API's figure. They must be the same number."""
    constants = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "constants.ts"
    m = re.search(r"export const FREE_SHIPPING_THRESHOLD = (\d+(?:\.\d+)?);", constants.read_text(encoding="utf-8"))
    assert m, "FREE_SHIPPING_THRESHOLD not found in frontend constants"
    assert float(m.group(1)) == checkout.FREE_SHIPPING_THRESHOLD


# --------------------------------------------------------------------------
# The admin's own offer title, and the Cairo calendar-day end.

TITLES = {"ot_ar": "عرض العناية اليومية", "ot_en": "Special Hair Care Offer"}
# What ecobel-accounting-system stores when an admin picks 15 Oct 2026 as
# the last day: the start of 16 Oct in Cairo (UTC+3 in October) — see its
# app/cairo_time.end_of_cairo_day and tests/test_offer_expiry.py.
CAIRO_END_15_OCT = datetime(2026, 10, 15, 21, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="module", autouse=True)
def seed_titles_and_cairo_end(seed):
    db = SessionLocal()
    for pid in (*TITLES, "ot_cairo"):
        db.add(models.Product(id=pid, name=pid, category_id="of_cat", sale_price=200, quantity=10))
    db.add_all([models.Offer(id=f"o_{pid}", product_id=pid, title=title, offer_price=160) for pid, title in TITLES.items()])
    db.add(models.Offer(id="o_ot_cairo", product_id="ot_cairo", title="عرض لحد ١٥ أكتوبر", offer_price=150, expires_at=CAIRO_END_15_OCT))
    db.add(models.Routine(id="ot_routine", name="روتين بعنوان عرض"))
    db.flush()
    db.add(models.RoutineItem(routine_id="ot_routine", product_id="ot_ar", position=0))
    db.commit()
    db.close()


@pytest.mark.parametrize("pid", list(TITLES))
def test_exact_admin_title_reaches_every_offer_response(pid):
    title = TITLES[pid]
    assert product(pid)["offer"]["title"] == title
    listing = {p["id"]: p for p in client.get("/catalog/products?on_offer=true&limit=100").json()["items"]}
    assert listing[pid]["offer"]["title"] == title
    line = client.post("/cart/quote", json={"items": [{"product_id": pid, "quantity": 1}]}).json()["lines"][0]
    assert line["product"]["offer"]["title"] == title and line["unit_price"] == 160 and line["regular_unit_price"] == 200


def test_routine_items_carry_their_offer_title():
    item = client.get("/catalog/routines/ot_routine").json()["items"][0]
    assert item["product"]["offer"]["title"] == TITLES["ot_ar"] and item["price"] == 160


def test_products_without_an_offer_carry_no_offer():
    p = product("of_plain")
    assert p["offer"] is None and p["price"] == p["sale_price"]


def test_coupons_are_never_part_of_catalog_responses():
    raw = client.get("/catalog/products?limit=100").text + client.get("/catalog/products/ot_ar").text
    assert "coupon" not in raw.lower() and "code" not in raw.lower()


@pytest.fixture
def clock(monkeypatch):
    from app import pricing

    def set_now(instant):
        monkeypatch.setattr(pricing, "now_utc", lambda: instant)
    return set_now


def test_offer_runs_through_the_whole_cairo_day(clock):
    items = [{"product_id": "ot_cairo", "quantity": 1}]
    # 23:59:59 on 15 Oct in Cairo — still the offer's last day.
    clock(CAIRO_END_15_OCT - timedelta(seconds=1))
    assert product("ot_cairo")["price"] == 150
    assert "ot_cairo" in {p["id"] for p in client.get("/catalog/products?on_offer=true&limit=100").json()["items"]}
    assert client.post("/cart/quote", json={"items": items}).json()["subtotal"] == 150
    # 00:00 on 16 Oct in Cairo — over everywhere at the same instant.
    clock(CAIRO_END_15_OCT)
    p = product("ot_cairo")
    assert p["offer"] is None and p["price"] == 200
    assert "ot_cairo" not in {p["id"] for p in client.get("/catalog/products?on_offer=true&limit=100").json()["items"]}
    assert client.post("/cart/quote", json={"items": items}).json()["subtotal"] == 200


def test_order_charges_the_offer_only_until_the_cairo_day_ends(clock):
    order = {"customer_name": "منى علي حسن", "customer_phone": "01055553333", "city": "مدينة اختبار العروض",
             "shipping_address": "شارع الهرم، عمارة 4", "items": [{"product_id": "ot_cairo", "quantity": 1}]}
    clock(CAIRO_END_15_OCT - timedelta(seconds=1))
    first = client.post("/orders/", json=order)
    assert first.status_code == 201 and first.json()["subtotal"] == 150
    clock(CAIRO_END_15_OCT)
    second = client.post("/orders/", json={**order, "customer_phone": "01055552222"})
    assert second.status_code == 201 and second.json()["subtotal"] == 200


# --------------------------------------------------------------------------
# End dates saved before the Cairo-day rule keep their exact meaning here
# too (old admin date picker: 00:00:00 UTC; imported data: 23:59:59 UTC).
LEGACY_ENDS = {
    "ot_old_picker": datetime(2026, 10, 31, 0, 0, 0, tzinfo=timezone.utc),
    "ot_imported": datetime(2026, 11, 20, 23, 59, 59, tzinfo=timezone.utc),
}


@pytest.fixture(scope="module", autouse=True)
def seed_legacy_and_blank_titles(seed):
    db = SessionLocal()
    for pid, end in LEGACY_ENDS.items():
        db.add(models.Product(id=pid, name=pid, category_id="of_cat", sale_price=200, quantity=10))
        db.add(models.Offer(id=f"o_{pid}", product_id=pid, title="عرض قديم", offer_price=150, expires_at=end))
    for pid, title in (("ot_blank", ""), ("ot_spaces", "   "), ("ot_retitled", "عرض الصيف")):
        db.add(models.Product(id=pid, name=pid, category_id="of_cat", sale_price=200, quantity=10))
        db.add(models.Offer(id=f"o_{pid}", product_id=pid, title=title, offer_price=150))
    db.commit()
    db.close()


@pytest.mark.parametrize("pid", list(LEGACY_ENDS))
def test_saved_end_times_apply_until_exactly_that_instant(clock, pid):
    end = LEGACY_ENDS[pid]
    items = [{"product_id": pid, "quantity": 1}]
    clock(end - timedelta(seconds=1))
    assert product(pid)["price"] == 150
    assert client.post("/cart/quote", json={"items": items}).json()["subtotal"] == 150
    clock(end)
    assert product(pid)["offer"] is None and product(pid)["price"] == 200
    assert client.post("/cart/quote", json={"items": items}).json()["subtotal"] == 200


@pytest.mark.parametrize("pid,title", [("ot_blank", ""), ("ot_spaces", "   ")])
def test_blank_legacy_title_still_sends_the_offer(pid, title):
    """The price still applies; the storefront shows its fallback label
    (frontend/src/lib/offers.ts) for a blank title — never an empty badge."""
    p = product(pid)
    assert p["offer"] is not None and p["offer"]["title"] == title and p["price"] == 150


def test_title_change_in_the_admin_reaches_the_storefront():
    assert product("ot_retitled")["offer"]["title"] == "عرض الصيف"
    db = SessionLocal()
    db.get(models.Offer, "o_ot_retitled").title = "عرض الشتا"
    db.commit()
    db.close()
    assert product("ot_retitled")["offer"]["title"] == "عرض الشتا"
    line = client.post("/cart/quote", json={"items": [{"product_id": "ot_retitled", "quantity": 1}]}).json()["lines"][0]
    assert line["product"]["offer"]["title"] == "عرض الشتا" and line["unit_price"] == 150
