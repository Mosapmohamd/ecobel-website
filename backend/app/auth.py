import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .database import get_db, DATABASE_URL

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DATABASE_URL.startswith("sqlite"):
        # Local SQLite (development/tests) only: a random key per process.
        # Never a fixed string in source — anyone can read that, so it
        # could be used to sign valid tokens. Sessions end on restart.
        SECRET_KEY = secrets.token_urlsafe(32)
    else:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set when DATABASE_URL "
            "points at a real database. Refusing to start with no secret "
            "configured — set SECRET_KEY in your environment/.env."
        )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
customer_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/account/login")
customer_oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/account/login", auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _decode(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def authenticate_customer(db: Session, phone: str, password: str) -> Optional[models.Customer]:
    # Accounts only — a guest profile with the same phone is a different identity.
    user = (
        db.query(models.Customer)
        .filter(models.Customer.phone == phone.strip())
        .filter(models.Customer.hashed_password.isnot(None))
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def _account(db: Session, customer_id: str) -> Optional[models.Customer]:
    customer = db.get(models.Customer, customer_id)
    return customer if customer is not None and customer.is_account else None


def get_current_customer(
    token: str = Depends(customer_oauth2_scheme), db: Session = Depends(get_db)
) -> models.Customer:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="بيانات الدخول غير صحيحة أو الجلسة منتهية",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = _decode(token)
        if payload.get("type") != "customer":
            raise credentials_exception
        customer_id: str = payload.get("sub")
        if customer_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    customer = _account(db, customer_id)
    if customer is None:
        raise credentials_exception
    return customer


def get_current_customer_optional(
    token: Optional[str] = Depends(customer_oauth2_scheme_optional), db: Session = Depends(get_db)
) -> Optional[models.Customer]:
    """For endpoints usable by both guests and logged-in customers (checkout):
    returns the Customer if a valid customer token was sent, else None —
    never raises, so a guest request without a token still succeeds."""
    if not token:
        return None
    try:
        payload = _decode(token)
        if payload.get("type") != "customer":
            return None
        customer_id: str = payload.get("sub")
        if customer_id is None:
            return None
    except JWTError:
        return None
    return _account(db, customer_id)
