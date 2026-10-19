"""Cash-on-delivery orders are capped — pending orders per guest phone or per
account, and orders per client IP per 24 h — counted in the database.
Refused requests change nothing. Synthetic data, throwaway DB."""
import os
import sys
import tempfile
import threading
from datetime import timedelta

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import abuse_limits, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)
CITY = "مدينة اختبار الحدود"


def client_from(ip):
    return TestClient(app, client=(ip, 50000))


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add(models.Category(id="gl_cat", name="فئة الحدود"))
    db.add(models.Product(id="gl_p", name="منتج الحدود", category_id="gl_cat", sale_price=100, quantity=1000))
    db.add(models.ShippingRate(city=CITY, fee=40))
    db.commit()
    db.close()
    limiter.enabled = False  # the per-minute request limit isn't what's tested here
    yield
    limiter.enabled = True


@pytest.fixture(autouse=True)
def production_limits(monkeypatch, generous_guest_limits):
    """The real defaults (overriding the generous test-wide values)."""
    monkeypatch.setattr(abuse_limits, "PENDING_PER_PHONE", abuse_limits._env_int("UNSET_FOR_TEST", 3))
    monkeypatch.setattr(abuse_limits, "PER_IP_PER_DAY", abuse_limits._env_int("UNSET_FOR_TEST", 10))
    monkeypatch.setattr(abuse_limits, "PENDING_PER_ACCOUNT", abuse_limits._env_int("UNSET_FOR_TEST", 3))


def order(c, phone, headers=None):
    return c.post("/orders/", headers=headers or {}, json={
        "customer_name": "منى علي حسن", "customer_phone": phone, "city": CITY,
        "shipping_address": "شارع اختبار الحدود ٤", "items": [{"product_id": "gl_p", "quantity": 1}],
    })


def snapshot():
    db = SessionLocal()
    try:
        return (db.get(models.Product, "gl_p").quantity, db.query(models.Order).count(),
                db.query(models.FinanceEntry).count(), db.query(models.InventoryMovement).count())
    finally:
        db.close()


def test_defaults_are_conservative():
    assert abuse_limits._env_int("UNSET_FOR_TEST", 3) == 3 and abuse_limits._env_int("UNSET_FOR_TEST", 10) == 10
    os.environ["GL_BAD"] = "not-a-number"
    assert abuse_limits._env_int("GL_BAD", 3) == 3  # a broken setting falls back, never "unlimited"
    os.environ["GL_BAD"] = "0"
    assert abuse_limits._env_int("GL_BAD", 3) == 3
    del os.environ["GL_BAD"]


def test_pending_guest_orders_per_phone_are_capped_and_refusal_changes_nothing():
    c = client_from("198.51.100.1")
    for _ in range(3):
        assert order(c, "01020000001").status_code == 201
    before = snapshot()
    refused = order(c, "01020000001")
    assert refused.status_code == 429 and refused.json()["detail"] == abuse_limits.LIMIT_REACHED
    assert snapshot() == before  # no stock, order, income or stock-movement change


def test_phone_formatting_cannot_bypass_the_cap():
    c = client_from("198.51.100.2")
    for _ in range(3):
        assert order(c, "01020000002").status_code == 201
    for variant in ("+20 102 000 0002", "0020-102-000-0002", "٠١٠٢٠٠٠٠٠٠٢", "20 1020000002"):
        assert order(c, variant).status_code == 429, variant


def test_finished_orders_free_the_phone_again():
    c = client_from("198.51.100.3")
    ids = [order(c, "01020000003").json()["id"] for _ in range(3)]
    assert order(c, "01020000003").status_code == 429
    db = SessionLocal()
    db.get(models.Order, ids[0]).status = models.OrderStatus.delivered
    db.commit()
    db.close()
    assert order(c, "01020000003").status_code == 201


def test_guest_orders_per_ip_per_day_are_capped(monkeypatch):
    monkeypatch.setattr(abuse_limits, "PER_IP_PER_DAY", 4)
    c = client_from("203.0.113.50")
    for i in range(4):
        assert order(c, f"0103000000{i}").status_code == 201
    assert order(c, "01030000009").status_code == 429            # same IP, new phone
    assert order(client_from("203.0.113.51"), "01030000009").status_code == 201  # another IP is fine


def test_ip_window_is_24_hours():
    c = client_from("203.0.113.60")
    db = SessionLocal()
    h = abuse_limits.keyed_hash("ip:203.0.113.60")
    db.close()
    for i in range(10):
        assert order(c, f"0104000000{i}" if i < 10 else "01040000099").status_code == 201
    assert order(c, "01040000050").status_code == 429
    db = SessionLocal()
    for o in db.query(models.Order).filter(models.Order.client_ip_hash == h).all():
        o.created_at = abuse_limits.now_utc() - timedelta(hours=25)
    db.commit()
    db.close()
    assert order(c, "01040000050").status_code == 201


def test_only_a_keyed_hash_of_the_ip_is_stored():
    created = order(client_from("203.0.113.70"), "01050000001").json()
    db = SessionLocal()
    stored = db.get(models.Order, created["id"]).client_ip_hash
    db.close()
    assert stored == abuse_limits.keyed_hash("ip:203.0.113.70") and "203.0.113.70" not in stored and len(stored) == 64


def test_concurrent_requests_cannot_bypass_the_cap(monkeypatch):
    monkeypatch.setattr(abuse_limits, "PENDING_PER_PHONE", 1)
    start = snapshot()
    barrier = threading.Barrier(6)
    codes = []

    def go(n):
        c = client_from(f"192.0.2.{n}")
        barrier.wait()
        codes.append(order(c, "01060000001").status_code)

    threads = [threading.Thread(target=go, args=(n,)) for n in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(codes) == [201] + [429] * 5, codes
    assert snapshot()[0] == start[0] - 1  # stock moved exactly once


def register(c, phone):
    token = c.post("/account/register", json={"name": "سارة محمود علي", "phone": phone, "password": "signed-in-1"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_a_new_account_cannot_drain_stock_with_unlimited_orders():
    """R2: accounts are unverified, so they get the guest caps too — the old
    behaviour let one fresh account place 8 x 100-unit orders."""
    c = client_from("203.0.113.80")
    auth = register(c, "01070000001")
    created = [order(c, "01070000001", headers=auth) for _ in range(3)]
    assert [r.status_code for r in created] == [201] * 3
    before = snapshot()
    refused = order(c, "01070000001", headers=auth)
    assert refused.status_code == 429 and refused.json()["detail"] == abuse_limits.LIMIT_REACHED
    assert snapshot() == before  # nothing reserved, charged or recorded
    db = SessionLocal()
    assert all(db.get(models.Order, r.json()["id"]).client_ip_hash for r in created)  # counted per IP too
    db.close()


def test_account_orders_count_toward_the_per_ip_cap(monkeypatch):
    monkeypatch.setattr(abuse_limits, "PER_IP_PER_DAY", 2)
    c = client_from("203.0.113.81")
    auth = register(c, "01070000002")
    assert order(c, "01070000003").status_code == 201                 # a guest from this IP
    assert order(c, "01070000002", headers=auth).status_code == 201   # an account from this IP
    assert order(c, "01070000002", headers=auth).status_code == 429   # the IP's 2 are used


def test_an_accounts_finished_orders_free_it_again():
    c = client_from("203.0.113.82")
    auth = register(c, "01070000004")
    ids = [order(c, "01070000004", headers=auth).json()["id"] for _ in range(3)]
    assert order(c, "01070000004", headers=auth).status_code == 429
    db = SessionLocal()
    db.get(models.Order, ids[0]).status = models.OrderStatus.delivered
    db.commit()
    db.close()
    assert order(c, "01070000004", headers=auth).status_code == 201

