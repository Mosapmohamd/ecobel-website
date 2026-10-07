"""Order ownership: a phone number alone never proves who owns an order.
Throwaway SQLite DB (never the shared development database):

    cd backend && python -m pytest -q
"""
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

OWNER_PHONE = "01066660001"   # registers an account
GUEST_A = "01066660002"
GUEST_B = "01066660003"


@pytest.fixture(scope="module", autouse=True)
def seed():
    limiter.enabled = False
    db = SessionLocal()
    db.add(models.Category(id="w_cat", name="فئة الملكية"))
    db.add(models.Product(id="w1", name="Ownership Serum", category_id="w_cat", sale_price=100, quantity=100))
    db.add(models.ShippingRate(city="أسوان", fee=60))
    db.commit()
    db.close()
    yield
    limiter.enabled = True


def guest_order(phone, name="ضيفة غير معروفة", address="عنوان سري جدا 12"):
    res = client.post("/orders/", json={
        "customer_name": name, "customer_phone": phone, "city": "أسوان",
        "shipping_address": address, "items": [{"product_id": "w1", "quantity": 1}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def register(phone, password="owner-pass-1"):
    res = client.post("/account/register", json={"name": "صاحبة الحساب", "phone": phone, "password": password})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def history(auth):
    return [o["order_number"] for o in client.get("/account/orders", headers=auth).json()]


def customer_of(order_number):
    db = SessionLocal()
    try:
        order = db.query(models.Order).filter_by(order_number=order_number).one()
        return order.customer_id, order.customer.is_account
    finally:
        db.close()


def test_registering_does_not_take_over_earlier_guest_orders():
    earlier = guest_order(OWNER_PHONE, name="ضيفة قبل التسجيل")
    auth = register(OWNER_PHONE)
    assert earlier["order_number"] not in history(auth)
    # ...and the account can't act on it either.
    assert client.delete(f"/orders/{earlier['id']}", headers=auth).status_code == 404
    # The guest order is still trackable the intended way.
    tracked = client.get("/orders/track", params={"order_number": earlier["order_number"], "phone": OWNER_PHONE})
    assert tracked.status_code == 200 and tracked.json()["shipping_address"] == "عنوان سري جدا 12"


def test_guest_checkout_with_an_account_phone_does_not_attach_to_that_account():
    auth = client.post("/account/login", json={"phone": OWNER_PHONE, "password": "owner-pass-1"})
    assert auth.status_code == 200, "login must still work while a guest profile shares the phone"
    auth = {"Authorization": f"Bearer {auth.json()['access_token']}"}
    stranger = guest_order(OWNER_PHONE, name="شخص غريب تماما", address="عنوان الغريب 99")
    owner_id, is_account = customer_of(stranger["order_number"])
    assert not is_account
    assert stranger["order_number"] not in history(auth)
    assert client.delete(f"/orders/{stranger['id']}", headers=auth).status_code == 404
    assert client.patch(f"/orders/{stranger['id']}", json={"items": [{"product_id": "w1", "quantity": 2}]}, headers=auth).status_code == 404


def test_one_guest_profile_per_phone_is_reused():
    first = guest_order(GUEST_A)
    second = guest_order(GUEST_A)
    assert customer_of(first["order_number"])[0] == customer_of(second["order_number"])[0]


def test_guest_a_cannot_access_guest_b_order():
    b = guest_order(GUEST_B, address="عنوان ب الخاص")
    # Guest A knows B's order number but not B's phone: no details.
    wrong = client.get("/orders/track", params={"order_number": b["order_number"], "phone": GUEST_A})
    assert wrong.status_code == 404
    # Order number alone: status only, never the address or items.
    summary = client.get("/orders/track", params={"order_number": b["order_number"]}).json()
    assert summary == [{"order_number": b["order_number"], "status": "pending", "total_amount": b["total_amount"], "created_at": summary[0]["created_at"]}]
    # No guest can change an order (that needs an account that owns it).
    assert client.delete(f"/orders/{b['id']}").status_code == 401


def test_signed_in_customer_still_owns_and_manages_their_orders():
    auth = client.post("/account/login", json={"phone": OWNER_PHONE, "password": "owner-pass-1"}).json()["access_token"]
    auth = {"Authorization": f"Bearer {auth}"}
    res = client.post("/orders/", headers=auth, json={
        "customer_name": "صاحبة الحساب فعلا", "customer_phone": OWNER_PHONE, "city": "أسوان",
        "shipping_address": "عنوان صاحبة الحساب", "items": [{"product_id": "w1", "quantity": 1}],
    })
    assert res.status_code == 201
    mine = res.json()
    assert history(auth) == [mine["order_number"]]
    assert client.delete(f"/orders/{mine['id']}", headers=auth).json()["status"] == "cancelled"


def test_a_second_account_for_the_same_phone_is_refused():
    res = client.post("/account/register", json={"name": "حساب مكرر", "phone": OWNER_PHONE, "password": "another-1"})
    assert res.status_code == 400 and "سجّلي دخول" in res.json()["detail"]


def test_registration_validates_phone_and_password_in_arabic():
    bad_phone = client.post("/account/register", json={"name": "اسم", "phone": "01", "password": "secret12"})
    assert bad_phone.status_code == 422 and bad_phone.json()["detail"].startswith("رقم التليفون")
    short = client.post("/account/register", json={"name": "اسم", "phone": "01066660099", "password": "123"})
    assert short.status_code == 422 and short.json()["detail"].startswith("كلمة المرور")
