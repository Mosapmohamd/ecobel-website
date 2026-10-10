"""Limits on guest (not signed-in) cash-on-delivery orders.

A guest order reserves real stock and records income straight away, and
anyone can place one. These limits keep a script from tying up stock with
fake orders, without getting in the way of normal customers:

  GUEST_PENDING_ORDERS_PER_PHONE  pending guest orders one phone may have  (default 3)
  GUEST_ORDERS_PER_IP_PER_DAY     guest orders one IP may place in 24 h    (default 10)

Both are counted in the database, so they hold across every server process
(the per-minute request limit in rate_limit.py is per process). Signed-in
customers' orders aren't limited here.

The client IP is whatever uvicorn resolved: behind the hosting proxy it's
the visitor's address only when uvicorn runs with --proxy-headers and
--forwarded-allow-ips set to the proxy's private ranges (render.yaml) —
X-Forwarded-For from anyone else is ignored. Only an HMAC of the IP is
stored (orders.client_ip_hash), never the address itself.
"""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from . import models
from .auth import SECRET_KEY


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, default))
    except ValueError:
        return default
    return value if value > 0 else default


PENDING_PER_PHONE = _env_int("GUEST_PENDING_ORDERS_PER_PHONE", 3)
PER_IP_PER_DAY = _env_int("GUEST_ORDERS_PER_IP_PER_DAY", 10)
IP_WINDOW = timedelta(hours=24)

# Deliberately says nothing about why (another order, this phone, this IP).
LIMIT_REACHED = "مش قادرين نستقبل طلب جديد دلوقتي — حاولي تاني بعدين، أو كلمينا ونأكدلك طلبك"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def keyed_hash(value: str) -> str:
    """HMAC-SHA256 with the server secret: stable for comparisons, but a
    short value like an IPv4 address can't be recovered from it."""
    return hmac.new(SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def _serialize(db: Session, *keys: str) -> None:
    """Make concurrent guest checkouts for the same phone / IP take turns,
    so two requests can't both pass a limit before either is saved.
    PostgreSQL: transaction-scoped advisory locks (released at commit or
    rollback), always taken in the same order. SQLite (tests, local dev):
    taking the database write lock serializes every writer anyway."""
    if db.bind.dialect.name == "postgresql":
        for key in sorted(keys):
            lock_id = int.from_bytes(bytes.fromhex(keyed_hash(f"lock:{key}")[:16]), "big", signed=True)
            db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_id})
    else:
        db.execute(text("UPDATE customers SET id = id WHERE 1 = 0"))


def check_guest_order(db: Session, phone: str, client_ip: str | None) -> str | None:
    """Raises 429 when a guest checkout is over a limit; otherwise returns
    the IP hash to store on the new order. Call before any stock moves —
    a refused request then changes nothing."""
    ip_hash = keyed_hash(f"ip:{client_ip}") if client_ip else None
    _serialize(db, f"phone:{phone}", *( [f"ip:{ip_hash}"] if ip_hash else [] ))

    pending = (
        db.query(func.count(models.Order.id))
        .join(models.Customer, models.Customer.id == models.Order.customer_id)
        .filter(models.Customer.hashed_password.is_(None))  # guest profile
        .filter(models.Order.customer_phone == phone)
        .filter(models.Order.status == models.OrderStatus.pending)
        .scalar()
    )
    if pending >= PENDING_PER_PHONE:
        raise HTTPException(429, LIMIT_REACHED)

    if ip_hash:
        recent = (
            db.query(func.count(models.Order.id))
            .filter(models.Order.client_ip_hash == ip_hash)
            .filter(models.Order.created_at >= now_utc() - IP_WINDOW)
            .scalar()
        )
        if recent >= PER_IP_PER_DAY:
            raise HTTPException(429, LIMIT_REACHED)
    return ip_hash
