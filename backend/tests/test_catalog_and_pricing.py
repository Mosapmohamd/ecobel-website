"""Catalog, merchandising and pricing — run against a throwaway SQLite DB
(never the shared development database):

    cd backend && python -m pytest -q
"""
import os
import tempfile

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

# The real schema is migrated by ecobel-accounting-system; for this
# throwaway SQLite DB the models' tables are enough.
models.Base.metadata.create_all(bind=engine)

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    skin = models.Category(id="c_skin", name="العناية بالبشرة")
    hair = models.Category(id="c_hair", name="العناية بالشعر")
    db.add_all([skin, hair])
    db.add_all([
        models.Product(id="p1", name="Face Serum", category_id="c_skin", sale_price=300, quantity=50, description="Vitamin C serum"),
        models.Product(id="p2", name="Face Cream", category_id="c_skin", sale_price=200, quantity=3),
        models.Product(id="p3", name="Hair Oil", category_id="c_hair", sale_price=150, quantity=20),
        models.Product(id="p4", name="Retired Mask", category_id="c_skin", sale_price=100, quantity=10, is_active=False),
        models.Product(id="p5", name="Sold Out Toner", category_id="c_skin", sale_price=120, quantity=0),
    ])
    # Two active offers on p1 — the lowest must win, deterministically.
    db.add_all([
        models.Offer(id="o1", product_id="p1", title="خصم", offer_price=250),
        models.Offer(id="o2", product_id="p1", title="خصم أكبر", offer_price=240),
        # An "offer" priced above the product never applies.
        models.Offer(id="o3", product_id="p3", title="خطأ", offer_price=180),
    ])
    db.add_all([
        models.Routine(id="r1", name="Skin Routine"),
        models.Routine(id="r2", name="Broken Routine"),
    ])
    db.flush()
    db.add_all([
        models.RoutineItem(routine_id="r1", product_id="p1", position=0),
        models.RoutineItem(routine_id="r1", product_id="p2", position=1),
        models.RoutineItem(routine_id="r2", product_id="p3", position=0),
        models.RoutineItem(routine_id="r2", product_id="p5", position=1),
    ])
    db.add_all([
        models.FeaturedProduct(position=1, product_id="p3"),
        models.FeaturedProduct(position=2, product_id="p4"),  # inactive → skipped
        models.FeaturedProduct(position=3, product_id="p1"),
        models.FeaturedRoutine(position=1, routine_id="r2"),  # unavailable → skipped
        models.FeaturedRoutine(position=2, routine_id="r1"),
    ])
    db.add(models.ShippingRate(city="القاهرة", fee=40))
    db.commit()
    db.close()


def ids(items):
    return [p["id"] for p in items]


def test_catalog_lists_only_sellable_products_with_server_prices():
    page = client.get("/catalog/products?sort=name").json()
    assert page["total"] == 3
    assert ids(page["items"]) == ["p2", "p1", "p3"]
    p1 = next(p for p in page["items"] if p["id"] == "p1")
    assert p1["price"] == 240 and p1["sale_price"] == 300 and p1["offer"]["id"] == "o2"
    p3 = next(p for p in page["items"] if p["id"] == "p3")
    assert p3["price"] == 150 and p3["offer"] is None
    assert "quantity" not in p1 and p1["max_quantity"] == 50


def test_price_sort_filter_and_offer_filter_use_charged_price():
    asc = client.get("/catalog/products?sort=price_asc").json()["items"]
    assert ids(asc) == ["p3", "p2", "p1"]
    ranged = client.get("/catalog/products?min_price=230&max_price=245").json()["items"]
    assert ids(ranged) == ["p1"]
    offers = client.get("/catalog/products?on_offer=true").json()["items"]
    assert ids(offers) == ["p1"]


def test_search_matches_name_description_and_arabic_category():
    assert ids(client.get("/catalog/products", params={"q": "vitamin"}).json()["items"]) == ["p1"]
    assert sorted(ids(client.get("/catalog/products", params={"q": "بالبشرة"}).json()["items"])) == ["p1", "p2"]
    assert client.get("/catalog/products", params={"q": "nothing-matches"}).json()["total"] == 0


def test_pagination():
    first = client.get("/catalog/products?sort=name&limit=2").json()
    second = client.get("/catalog/products?sort=name&limit=2&offset=2").json()
    assert first["total"] == second["total"] == 3
    assert ids(first["items"]) == ["p2", "p1"] and ids(second["items"]) == ["p3"]


def test_category_counts_match_listing():
    counts = {c["id"]: c["product_count"] for c in client.get("/catalog/categories").json()}
    assert counts == {"c_skin": 2, "c_hair": 1}


def test_featured_products_follow_staff_order_and_skip_unsellable():
    assert ids(client.get("/catalog/featured-products").json()) == ["p3", "p1"]


def test_featured_routines_skip_unavailable():
    featured = client.get("/catalog/featured-routines").json()
    assert [r["id"] for r in featured] == ["r1"]


def test_routines_listing_detail_and_savings():
    routines = {r["id"]: r for r in client.get("/catalog/routines").json()}
    assert set(routines) == {"r1", "r2"}
    r1 = routines["r1"]
    assert r1["regular_total"] == 500 and r1["total"] == 440 and r1["savings"] == 60 and r1["is_available"]
    assert routines["r2"]["is_available"] is False
    assert client.get("/catalog/routines/r1").json()["total"] == 440
    assert client.get("/catalog/routines/missing").status_code == 404


def test_routine_search_matches_name_and_description_only_active():
    db = SessionLocal()
    db.add(models.Routine(id="r_hidden", name="Skin Hidden", is_active=False))
    db.query(models.Routine).filter_by(id="r1").update({"description": "صباحي للبشرة"})
    db.commit()
    db.close()
    assert [r["id"] for r in client.get("/catalog/routines", params={"q": "skin"}).json()] == ["r1"]
    assert [r["id"] for r in client.get("/catalog/routines", params={"q": "صباحي"}).json()] == ["r1"]
    assert client.get("/catalog/routines", params={"q": "nothing-matches"}).json() == []
    assert {r["id"] for r in client.get("/catalog/routines").json()} == {"r1", "r2"}


def test_product_photos_come_back_as_absolute_urls_built_from_the_storage_key(monkeypatch):
    from app import product_images
    monkeypatch.setattr(product_images, "PUBLIC_BASE_URL", "https://ref.supabase.co/storage/v1/object/public/product-images")
    db = SessionLocal()
    db.query(models.Product).filter_by(id="p3").update({"image_key": "products/p3/abc.webp"})
    db.commit()
    db.close()
    try:
        url = "https://ref.supabase.co/storage/v1/object/public/product-images/products/p3/abc.webp"
        assert client.get("/catalog/products/p3").json()["image_url"] == url
        assert next(p for p in client.get("/catalog/featured-products").json() if p["id"] == "p3")["image_url"] == url
        quoted = client.post("/cart/quote", json={"items": [{"product_id": "p3", "quantity": 1}]}).json()
        assert quoted["lines"][0]["product"]["image_url"] == url
        assert client.get("/catalog/products/p1").json()["image_url"] is None  # no photo → null, never a guess
    finally:
        db = SessionLocal()
        db.query(models.Product).filter_by(id="p3").update({"image_key": None})
        db.commit()
        db.close()


def test_related_products_exclude_self_and_other_categories():
    assert ids(client.get("/catalog/products/p1/related").json()) == ["p2"]


def test_product_page_hides_inactive_but_shows_sold_out():
    assert client.get("/catalog/products/p4").status_code == 404
    sold_out = client.get("/catalog/products/p5").json()
    assert sold_out["max_quantity"] == 0 and sold_out["stock_status"] == "out"


def test_cart_quote_prices_like_checkout_and_flags_problems():
    q = client.post("/cart/quote", json={"items": [
        {"product_id": "p1", "quantity": 2},
        {"product_id": "p2", "quantity": 5},
        {"product_id": "p4", "quantity": 1},
        {"product_id": "p5", "quantity": 1},
    ]}).json()
    lines = {l["product_id"]: l for l in q["lines"]}
    assert lines["p1"]["unit_price"] == 240 and lines["p1"]["line_total"] == 480 and lines["p1"]["issue"] is None
    assert lines["p2"]["issue"] == "insufficient_stock"
    assert lines["p4"]["issue"] == "unavailable"
    assert lines["p5"]["issue"] == "out_of_stock"
    assert q["has_issues"] and q["subtotal"] == 480 and q["savings"] == 120


def test_checkout_charges_exactly_the_quoted_price():
    items = [{"product_id": "p1", "quantity": 1}, {"product_id": "p3", "quantity": 2}]
    quoted = client.post("/cart/quote", json={"items": items}).json()
    order = client.post("/orders/", json={
        "customer_name": "سارة أحمد محمد",
        "customer_phone": "01011112222",
        "city": "القاهرة",
        "shipping_address": "شارع 9، المعادي",
        "items": items,
    })
    assert order.status_code == 201, order.text
    body = order.json()
    assert body["subtotal"] == quoted["subtotal"] == 540
    assert body["total_amount"] == 540 + 40
