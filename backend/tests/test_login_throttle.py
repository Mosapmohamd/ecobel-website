"""Customer sign-in: failures are throttled per phone across IPs, blocks
expire, nothing reveals whether an account exists, and existing short
passwords keep working. Synthetic accounts, throwaway DB."""
import os
import sys
import tempfile
from datetime import timedelta

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth, login_throttle, models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)
WRONG = "رقم التليفون أو كلمة المرور غير صحيحة"


@pytest.fixture(scope="module", autouse=True)
def seed():
    db = SessionLocal()
    db.add(models.Customer(name="منى علي حسن", phone="01080000001", hashed_password=auth.hash_password("correct-pass-1")))
    db.add(models.Customer(name="سارة محمود علي", phone="01080000002", hashed_password=auth.hash_password("other-pass-12")))
    # Registered before the 8-character rule: a 6-character password.
    db.add(models.Customer(name="هدى أحمد علي", phone="01080000003", hashed_password=auth.hash_password("abc123")))
    db.add(models.Customer(name="ليلى حسن علي", phone="01080000004", hashed_password=auth.hash_password("window-pass-1")))
    db.add(models.Customer(name="نور محمد علي", phone="01080000005", hashed_password=auth.hash_password("expiry-pass-1")))
    db.commit()
    db.close()
    limiter.enabled = False  # the per-IP request limit isn't what's tested here
    yield
    limiter.enabled = True


@pytest.fixture
def clock(monkeypatch):
    state = {"now": login_throttle.now_utc()}
    monkeypatch.setattr(login_throttle, "now_utc", lambda: state["now"])
    return state


def login(phone, password, ip="198.51.100.10"):
    return TestClient(app, client=(ip, 40000)).post("/account/login", json={"phone": phone, "password": password})


def test_failures_for_one_account_are_throttled_across_ips():
    for n in range(login_throttle.MAX_FAILURES):
        assert login("01080000001", "wrong-guess", ip=f"203.0.113.{n}").status_code == 401
    blocked = login("01080000001", "correct-pass-1", ip="192.0.2.99")  # even the right password, from a new IP
    assert blocked.status_code == 429 and blocked.json()["detail"] == login_throttle.TOO_MANY
    assert login("01080000002", "other-pass-12").status_code == 200  # other accounts unaffected


def test_success_below_the_limit_works_and_resets_the_count():
    for _ in range(login_throttle.MAX_FAILURES - 1):
        login("01080000002", "nope")
    assert login("01080000002", "other-pass-12").status_code == 200
    for _ in range(login_throttle.MAX_FAILURES - 1):
        assert login("01080000002", "nope").status_code == 401  # counting started again
    assert login("01080000002", "other-pass-12").status_code == 200


def test_block_expires(clock):
    for _ in range(login_throttle.MAX_FAILURES):
        login("01080000005", "nope")
    assert login("01080000005", "expiry-pass-1").status_code == 429
    clock["now"] += login_throttle.BLOCK + timedelta(seconds=1)
    assert login("01080000005", "expiry-pass-1").status_code == 200


def test_old_failures_fall_out_of_the_window(clock):
    for _ in range(login_throttle.MAX_FAILURES - 1):
        login("01080000004", "nope")
    clock["now"] += login_throttle.WINDOW + timedelta(seconds=1)
    for _ in range(login_throttle.MAX_FAILURES - 1):
        assert login("01080000004", "nope").status_code == 401
    assert login("01080000004", "window-pass-1").status_code == 200


def test_responses_never_reveal_whether_an_account_exists(monkeypatch):
    exists, missing = login("01080000002", "wrong-guess"), login("01089999999", "wrong-guess")
    assert exists.status_code == missing.status_code == 401
    assert exists.json() == missing.json() == {"detail": WRONG}
    for _ in range(login_throttle.MAX_FAILURES - 1):
        login("01089999999", "wrong-guess")
    assert login("01089999999", "wrong-guess").status_code == 429  # unknown numbers are throttled the same way
    checked = []
    real = auth.verify_password
    monkeypatch.setattr(auth, "verify_password", lambda p, h: checked.append(h) or real(p, h))
    login("01088888888", "x")
    assert checked == [auth._NO_ACCOUNT_HASH]  # a password hash is still checked → no timing shortcut


def test_existing_short_passwords_still_sign_in():
    assert login("01080000003", "abc123").status_code == 200


def test_new_passwords_need_8_characters():
    c = TestClient(app)
    short = c.post("/account/register", json={"name": "هبة سامي علي", "phone": "01080000009", "password": "seven77"})
    assert short.status_code == 422 and "8" in short.json()["detail"]
    ok = c.post("/account/register", json={"name": "هبة سامي علي", "phone": "01080000009", "password": "eight888"})
    assert ok.status_code == 201


def test_phone_is_normalized_and_never_stored_in_the_throttle_table():
    assert login("+20 108 000 0002", "other-pass-12").status_code == 200
    login("٠١٠٨٠٠٠٠٠٠٢", "wrong")
    db = SessionLocal()
    try:
        keys = [r.key for r in db.query(models.AuthThrottle).all()]
    finally:
        db.close()
    assert keys and all("0108" not in k and len(k) == 64 for k in keys)


def test_stale_throttle_rows_are_purged_but_live_blocks_are_kept():
    """auth_throttle doesn't grow forever: a failure drops rows idle for
    longer than STALE_AFTER, never one whose block is still running."""
    now = login_throttle.now_utc()
    old = now - login_throttle.STALE_AFTER - timedelta(minutes=1)
    db = SessionLocal()
    db.add(models.AuthThrottle(key="stale-customer", failures=3, window_started_at=old))
    db.add(models.AuthThrottle(key="stale-blocked-customer", failures=10, window_started_at=old, blocked_until=now + timedelta(hours=1)))
    db.add(models.AuthThrottle(key="recent-customer", failures=2, window_started_at=now - timedelta(minutes=5)))
    db.commit()
    db.close()
    assert login("01080009999", "wrong-password-x").status_code == 401
    db = SessionLocal()
    keys = {k for (k,) in db.query(models.AuthThrottle.key).all()}
    db.close()
    assert "stale-customer" not in keys
    assert {"stale-blocked-customer", "recent-customer"} <= keys
