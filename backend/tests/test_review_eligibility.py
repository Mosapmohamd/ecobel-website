"""Only a customer whose own order with the product was delivered may review
it. Synthetic customers and orders, throwaway DB."""
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402
from app.routers.reviews import NOT_RECEIVED  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
STATUSES = {"delivered": "rv_delivered", "pending": "rv_pending", "shipped": "rv_shipped", "cancelled": "rv_cancelled"}


def customer_token(cid):
    return {"Authorization": f"Bearer {auth.create_access_token({'sub': cid, 'type': 'customer'})}"}


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add(models.Category(id="rv_cat", name="فئة التقييمات"))
    for pid in ("rv_p1", "rv_p2"):
        db.add(models.Product(id=pid, name=pid, category_id="rv_cat", sale_price=100, quantity=10))
    for n, (status, cid) in enumerate(STATUSES.items()):
        db.add(models.Customer(id=cid, name="منى علي حسن", phone=f"0109900000{n}",
                               hashed_password=auth.hash_password("review-pass-1")))
        db.add(models.Order(id=f"o_{cid}", order_number=f"EBRV{status.upper()[:6]}", customer_id=cid,
                            customer_name="منى علي حسن", customer_phone="01000000000", city="القاهرة",
                            shipping_address="عنوان التقييم", status=models.OrderStatus(status),
                            subtotal=100, total_amount=100))
        db.add(models.OrderItem(order_id=f"o_{cid}", product_id="rv_p1", product_name="rv_p1", unit_price=100, quantity=1, line_total=100))
    db.add(models.Customer(id="rv_stranger", name="سارة محمود علي", phone="01099999991", hashed_password=auth.hash_password("review-pass-1")))
    db.commit()
    db.close()
    limiter.enabled = False
    yield
    limiter.enabled = True


def review(cid, product="rv_p1", rating=5):
    return client.post(f"/products/{product}/reviews/", headers=customer_token(cid), json={"rating": rating, "comment": "منتج كويس"})


def eligibility(cid, product="rv_p1"):
    return client.get(f"/products/{product}/reviews/eligibility", headers=customer_token(cid)).json()


def test_delivered_order_allows_one_review():
    assert eligibility(STATUSES["delivered"]) == {"can_review": True, "reason": None}
    assert review(STATUSES["delivered"]).status_code == 201
    dup = review(STATUSES["delivered"])
    assert dup.status_code == 400  # existing duplicate protection still holds
    assert eligibility(STATUSES["delivered"])["can_review"] is False


@pytest.mark.parametrize("status", ["pending", "shipped", "cancelled"])
def test_undelivered_or_cancelled_orders_cannot_review(status):
    cid = STATUSES[status]
    res = review(cid)
    assert res.status_code == 403 and res.json()["detail"] == NOT_RECEIVED
    assert eligibility(cid) == {"can_review": False, "reason": NOT_RECEIVED}


def test_someone_elses_delivered_order_does_not_count():
    res = review("rv_stranger")
    assert res.status_code == 403 and eligibility("rv_stranger")["can_review"] is False


def test_only_the_product_in_the_delivered_order_can_be_reviewed():
    assert review(STATUSES["delivered"], product="rv_p2").status_code == 403


def test_review_still_requires_sign_in_and_valid_input():
    assert client.post("/products/rv_p1/reviews/", json={"rating": 5}).status_code == 401
    assert review(STATUSES["shipped"], rating=0).status_code == 422
    assert client.post("/products/missing/reviews/", headers=customer_token(STATUSES["delivered"]), json={"rating": 5}).status_code == 404
