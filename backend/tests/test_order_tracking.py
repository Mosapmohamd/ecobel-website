"""Guest order tracking can't leak a customer's details to someone who only
knows (or guesses) their phone number. Synthetic customers, throwaway DB."""
import os
import re
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
from app.routers import orders as orders_router  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)

VICTIM = "01011110001"
OTHER = "01011110002"
CITY = "مدينة اختبار التتبع"
PRIVATE = ["منى علي حسن", "١٢ شارع الضحية، الدور ٣"]


@pytest.fixture(autouse=True)
def fresh_limits():
    """Each test starts with clean per-IP rate limits (they're per process)."""
    from app.rate_limit import limiter
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add(models.Category(id="tr_cat", name="فئة التتبع"))
    db.add(models.Product(id="tr_p", name="منتج سري للتتبع", category_id="tr_cat", sale_price=100, quantity=50))
    db.add(models.ShippingRate(city=CITY, fee=40))
    db.commit()
    db.close()


def place(phone, name="منى علي حسن", address="١٢ شارع الضحية، الدور ٣", headers=None):
    res = client.post("/orders/", headers=headers or {}, json={
        "customer_name": name, "customer_phone": phone, "city": CITY,
        "shipping_address": address, "items": [{"product_id": "tr_p", "quantity": 1}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def track(**params):
    return client.get("/orders/track", params=params)


def test_phone_only_reveals_no_order_number_or_private_data():
    order = place(VICTIM)
    res = track(phone=VICTIM)
    assert res.status_code == 200
    body = res.text
    summary = res.json()[0]
    assert set(summary) == {"reference", "status", "created_at"}
    assert order["order_number"] not in body
    assert all(secret not in body for secret in PRIVATE + ["منتج سري للتتبع", "shipping_address", "total"])
    assert summary["reference"].startswith("EB") and "•" in summary["reference"]


def test_phone_only_answer_cannot_be_chained_into_the_full_order():
    place(VICTIM)
    for s in track(phone=VICTIM).json():
        for guess in (s["reference"], s["reference"].replace("•", "")):
            res = track(order_number=guess, phone=VICTIM)
            assert res.status_code == 404
            assert all(secret not in res.text for secret in PRIVATE)


def test_guest_with_order_reference_and_phone_sees_their_order():
    order = place(VICTIM)
    ref = order["order_number"]
    # Any reasonable way of typing either value works.
    for number, phone in ((ref, VICTIM), (ref.lower(), "+20 101 111 0001"), (f"{ref[:4]}-{ref[4:]}", "٠١٠١١١١٠٠٠١")):
        res = track(order_number=number, phone=phone)
        assert res.status_code == 200, (number, phone)
        full = res.json()
        assert full["order_number"] == ref and full["shipping_address"] == PRIVATE[1]


def test_wrong_pair_looks_exactly_like_no_order():
    order = place(VICTIM)
    wrong_phone = track(order_number=order["order_number"], phone=OTHER)
    no_such = track(order_number="EB22222ZZZZZ", phone=VICTIM)
    assert wrong_phone.status_code == no_such.status_code == 404
    assert wrong_phone.json() == no_such.json()
    assert all(secret not in wrong_phone.text for secret in PRIVATE)
    assert track(phone="01055550404").json() == no_such.json()  # a number with no orders


def test_signed_in_customer_cannot_touch_someone_elses_order():
    victim_order = place(VICTIM)
    token = client.post("/account/register", json={"name": "سارة محمود علي", "phone": OTHER, "password": "other-pass-1"}).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    assert client.delete(f"/orders/{victim_order['id']}", headers=auth).status_code == 404
    edit = client.patch(f"/orders/{victim_order['id']}", headers=auth, json={"items": [{"product_id": "tr_p", "quantity": 2}]})
    assert edit.status_code == 404
    mine = client.get("/account/orders", headers=auth).json()
    assert victim_order["order_number"] not in [o["order_number"] for o in mine]


def test_order_references_are_unpredictable_and_unique():
    ref = place(VICTIM)["order_number"]
    assert re.fullmatch(rf"EB[{orders_router.ORDER_REF_ALPHABET}]{{{orders_router.ORDER_REF_LENGTH}}}", ref)
    refs = {orders_router._new_order_ref() for _ in range(5000)}
    assert len(refs) == 5000  # no repeats in 5000 draws
    import inspect
    assert "secrets.choice" in inspect.getsource(orders_router._new_order_ref)


def test_collision_is_retried_and_endless_collisions_fail_safely(monkeypatch):
    taken = place(VICTIM)["order_number"]
    fresh = "EB" + "Z" * orders_router.ORDER_REF_LENGTH
    draws = iter([taken, taken, fresh])
    monkeypatch.setattr(orders_router, "_new_order_ref", lambda: next(draws))
    db = SessionLocal()
    try:
        assert orders_router._generate_order_number(db) == fresh
        monkeypatch.setattr(orders_router, "_new_order_ref", lambda: taken)
        with pytest.raises(Exception) as err:
            orders_router._generate_order_number(db)
        assert getattr(err.value, "status_code", None) == 500
    finally:
        db.close()


def test_legacy_short_reference_reveals_none_of_its_digits():
    """Old orders have EB + 6 digits. Showing the last 2 would leave only
    10^4 guesses for someone who knows the phone; nothing is shown."""
    db = SessionLocal()
    legacy_phone = "01011110003"
    db.add(models.Customer(id="tr_legacy", name="عميل قديم", phone=legacy_phone))
    db.add(models.Order(id="o_tr_legacy", order_number="EB583941", customer_id="tr_legacy", customer_name="عميل قديم",
                        customer_phone=legacy_phone, city=CITY, shipping_address="عنوان قديم", subtotal=100, total_amount=140))
    db.commit()
    db.close()
    ref = track(phone=legacy_phone).json()[0]["reference"]
    assert ref == "EB••••••" and not re.search(r"\d", ref)
    assert orders_router.mask_order_ref("EB7K4MQ9XR2T") == "EB••••••••2T"  # current references unchanged
