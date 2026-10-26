"""Customer-side order bookkeeping (app/order_ledger.py): placing an order
books no revenue (only completed + paid orders are revenue — the accounting
system recognizes it on delivery); editing never edits the ledger; customer
cancellation gives back exactly the stock still held and reverses revenue
only if some was recognized — each once. Throwaway SQLite DB."""
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models, order_ledger, services  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
CITY = "المنيا-ol"


@pytest.fixture(scope="module", autouse=True)
def seed():
    limiter.enabled = False
    db = SessionLocal()
    db.add(models.Category(id="ol_cat", name="فئة الدفاتر"))
    db.add(models.Product(id="ol_p", name="Lotion", category_id="ol_cat", sale_price=100, quantity=30))
    db.add(models.ShippingRate(city=CITY, fee=25))
    db.commit()
    db.close()
    yield
    limiter.enabled = True


@pytest.fixture()
def auth():
    import uuid
    phone = "0101" + str(uuid.uuid4().int)[:7]
    res = client.post("/account/register", json={"name": "ليلى سامي حسن", "phone": phone, "password": "secret123"})
    assert res.status_code == 201, res.text
    return phone, {"Authorization": f"Bearer {res.json()['access_token']}"}


def place(auth, qty=2):
    phone, headers = auth
    res = client.post("/orders/", headers=headers, json={"customer_name": "ليلى سامي حسن", "customer_phone": phone, "city": CITY,
                                                        "shipping_address": "شارع الكورنيش 4", "items": [{"product_id": "ol_p", "quantity": qty}]})
    assert res.status_code == 201, res.text
    return res.json()


def entries(oid):
    db = SessionLocal()
    try:
        return sorted((e.type.value, e.category, e.amount) for e in db.query(models.FinanceEntry).filter_by(reference_id=oid).all())
    finally:
        db.close()


def stock():
    db = SessionLocal()
    try:
        return db.get(models.Product, "ol_p").quantity
    finally:
        db.close()


def test_placing_and_editing_an_order_books_no_revenue(auth):
    o = place(auth)
    assert entries(o["id"]) == []  # pending + unpaid → not revenue
    edited = client.patch(f"/orders/{o['id']}", headers=auth[1], json={"items": [{"product_id": "ol_p", "quantity": 3}]})
    assert edited.status_code == 200 and entries(o["id"]) == []


def test_cancelling_a_new_order_restores_stock_once_and_writes_no_reversal(auth):
    before = stock()
    o = place(auth, qty=2)
    assert stock() == before - 2
    assert client.delete(f"/orders/{o['id']}", headers=auth[1]).status_code == 200
    assert stock() == before and entries(o["id"]) == []
    assert client.delete(f"/orders/{o['id']}", headers=auth[1]).status_code == 409  # already cancelled
    assert stock() == before


def test_cancelling_an_order_booked_at_checkout_reverses_it_exactly_once(auth):
    o = place(auth, qty=1)
    db = SessionLocal()  # as orders placed before revenue waited for delivery
    db.add(models.FinanceEntry(type=models.FinanceEntryType.income, category=order_ledger.SALE_CATEGORY,
                               amount=o["total_amount"], reference_id=o["id"], source="website"))
    db.commit()
    db.close()
    assert client.delete(f"/orders/{o['id']}", headers=auth[1]).status_code == 200
    total = o["total_amount"]
    assert entries(o["id"]) == sorted([("income", order_ledger.SALE_CATEGORY, total), ("expense", order_ledger.REVERSAL_CATEGORY, total)])
    db = SessionLocal()
    assert order_ledger.settle_revenue(db, models, db.get(models.Order, o["id"]), "retry") is None
    assert order_ledger.recognized_amount(db, models, o["id"]) == 0
    db.close()


def test_an_edit_restores_only_what_the_order_held(auth):
    before = stock()
    o = place(auth, qty=4)
    assert stock() == before - 4
    client.patch(f"/orders/{o['id']}", headers=auth[1], json={"items": [{"product_id": "ol_p", "quantity": 1}]})
    assert stock() == before - 1
    db = SessionLocal()
    assert order_ledger.deducted_stock(db, models, o["id"]) == {"ol_p": 1}
    db.close()
    client.delete(f"/orders/{o['id']}", headers=auth[1])
    assert stock() == before


def test_restore_is_a_no_op_for_stock_that_was_never_deducted():
    db = SessionLocal()
    db.add(models.Order(id="ol_raw", order_number="OLRAW", customer_name="x", customer_phone="01000000000",
                        shipping_address="عنوان", subtotal=100, total_amount=100))
    db.commit()
    before = stock()
    assert order_ledger.restore_stock(db, models, services, db.get(models.Order, "ol_raw"), "x") == {}
    db.commit()
    db.close()
    assert stock() == before
