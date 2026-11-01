"""CRUD audit (2026-11-01) regressions — throwaway SQLite DB (never the
shared development database):

* WEB-1: a category's card count must equal the number of products its
  category page lists (same eligibility rule), as products are added,
  sold out, archived and moved between categories.
* WEB-2: editing the account profile validates like registration.
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

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add_all([models.Category(id="ca_a", name="فئة أ للمراجعة"), models.Category(id="ca_b", name="فئة ب للمراجعة"),
                models.Category(id="ca_empty", name="فئة فاضية للمراجعة")])
    db.add_all([
        models.Product(id="ca_1", name="A in stock", category_id="ca_a", sale_price=100, quantity=5),
        models.Product(id="ca_2", name="A sold out", category_id="ca_a", sale_price=100, quantity=0),
        models.Product(id="ca_3", name="A archived", category_id="ca_a", sale_price=100, quantity=5, is_active=False),
        models.Product(id="ca_4", name="B in stock", category_id="ca_b", sale_price=100, quantity=5),
    ])
    db.commit()
    db.close()


def counts() -> dict[str, int]:
    res = client.get("/catalog/categories")
    assert res.status_code == 200
    return {c["id"]: c["product_count"] for c in res.json() if c["id"].startswith("ca_")}


def listed(category_id: str) -> int:
    res = client.get("/catalog/products", params={"category_id": category_id, "limit": 100})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == len(body["items"])
    return body["total"]


def assert_cards_match_pages():
    for cid, n in counts().items():
        assert n == listed(cid), f"{cid}: card says {n}, page lists {listed(cid)}"


def set_product(pid: str, **fields):
    db = SessionLocal()
    p = db.get(models.Product, pid)
    for k, v in fields.items():
        setattr(p, k, v)
    db.commit()
    db.close()


def test_category_counts_match_listing_through_product_changes():
    assert counts() == {"ca_a": 2, "ca_b": 1, "ca_empty": 0}  # sold out counts, archived doesn't
    assert_cards_match_pages()

    set_product("ca_3", is_active=True)      # restored
    assert counts()["ca_a"] == 3
    assert_cards_match_pages()

    set_product("ca_1", category_id="ca_b")  # moved to another category
    assert counts() == {"ca_a": 2, "ca_b": 2, "ca_empty": 0}
    assert_cards_match_pages()

    set_product("ca_4", is_active=False)     # archived
    set_product("ca_2", quantity=7)          # restocked: still counted once
    assert counts() == {"ca_a": 2, "ca_b": 1, "ca_empty": 0}
    assert_cards_match_pages()


def test_all_products_total_equals_sum_of_category_counts():
    res = client.get("/catalog/categories").json()
    assert sum(c["product_count"] for c in res) == client.get("/catalog/products", params={"limit": 1}).json()["total"]


# ---------------- WEB-2 ----------------
def _account() -> dict:
    res = client.post("/account/register", json={"name": "منى عادل حسن", "phone": "01077778888", "password": "audit-pass-1"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_profile_update_validates_like_registration():
    h = _account()
    for body in ({"name": None}, {"name": " "}, {"name": "x" * 121}, {"address": "x" * 501}):
        assert client.patch("/account/me", headers=h, json=body).status_code == 422, body
    res = client.patch("/account/me", headers=h, json={"name": "  منى   عادل  "})
    assert res.status_code == 200 and res.json()["name"] == "منى عادل"
    assert client.patch("/account/me", headers=h, json={"address": None}).status_code == 200  # address may be cleared
    assert client.get("/account/me", headers=h).json()["name"] == "منى عادل"


def test_customer_mutations_need_a_customer_login_and_public_ones_are_the_intended_set():
    """Every storefront mutation is either one of the intended public ones
    (checkout, cart quote, register, sign-in) or answers 401 without a
    customer token. Order ownership itself: tests/test_order_ownership.py."""
    public = {("POST", "/orders/"), ("POST", "/cart/quote"), ("POST", "/account/register"), ("POST", "/account/login")}
    checked = 0
    for route_path, operations in app.openapi()["paths"].items():
        for method in {m.upper() for m in operations} & {"POST", "PUT", "PATCH", "DELETE"}:
            if (method, route_path) in public:
                continue
            path = route_path.replace("{", "").replace("}", "")
            for headers in ({}, {"Authorization": "Bearer not-a-real-token"}):
                res = client.request(method, path, headers=headers, json={"rating": 5})
                assert res.status_code == 401, (method, route_path, res.status_code)
            checked += 1
    assert checked >= 4


def test_storefront_shows_a_renamed_category_at_once():
    """Category management (admin) renames in place: products keep the
    category (same id), and every storefront read uses the new name — the
    category list, product cards and pages, and search by category name."""
    db = SessionLocal()
    db.add(models.Category(id="ca_ren", name="اسم قديم للفئة"))
    db.add(models.Product(id="ca_ren_p", name="Renamed category product", category_id="ca_ren", sale_price=50, quantity=3))
    db.commit()
    db.get(models.Category, "ca_ren").name = "اسم جديد للفئة"  # what PATCH /categories/{id} does
    db.commit()
    db.close()
    cats = {c["id"]: c for c in client.get("/catalog/categories").json()}
    assert cats["ca_ren"]["name"] == "اسم جديد للفئة" and cats["ca_ren"]["product_count"] == 1
    assert client.get("/catalog/products/ca_ren_p").json()["category_name"] == "اسم جديد للفئة"
    listing = client.get("/catalog/products", params={"category_id": "ca_ren"}).json()
    assert [p["id"] for p in listing["items"]] == ["ca_ren_p"] and listing["items"][0]["category_name"] == "اسم جديد للفئة"
    assert "ca_ren_p" in [p["id"] for p in client.get("/catalog/products", params={"q": "اسم جديد للفئة"}).json()["items"]]
    assert "ca_ren_p" not in [p["id"] for p in client.get("/catalog/products", params={"q": "اسم قديم للفئة"}).json()["items"]]
