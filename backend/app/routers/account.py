from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, auth
from ..database import get_db
from ..rate_limit import limiter

router = APIRouter(prefix="/account", tags=["Customer Account"])


@router.post("/register", response_model=schemas.Token, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, payload: schemas.CustomerRegister, db: Session = Depends(get_db)):
    # A new account never takes over an existing guest profile (or its
    # orders): owning a phone number isn't proven by typing it. Past guest
    # orders stay trackable with order number + phone.
    taken = (
        db.query(models.Customer)
        .filter(models.Customer.phone == payload.phone)
        .filter(models.Customer.hashed_password.isnot(None))
        .first()
    )
    if taken:
        raise HTTPException(400, "في حساب بالفعل بنفس رقم التليفون ده — سجّلي دخول بدل كده")

    customer = models.Customer(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:  # registered concurrently with the same phone
        db.rollback()
        raise HTTPException(400, "في حساب بالفعل بنفس رقم التليفون ده — سجّلي دخول بدل كده")
    db.refresh(customer)
    access_token = auth.create_access_token(data={"sub": customer.id, "type": "customer"})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, payload: schemas.CustomerLogin, db: Session = Depends(get_db)):
    customer = auth.authenticate_customer(db, payload.phone, payload.password)
    if not customer:
        raise HTTPException(401, "رقم التليفون أو كلمة المرور غير صحيحة")
    access_token = auth.create_access_token(data={"sub": customer.id, "type": "customer"})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.CustomerOut)
def get_me(customer: models.Customer = Depends(auth.get_current_customer)):
    return customer


@router.patch("/me", response_model=schemas.CustomerOut)
def update_me(
    payload: schemas.CustomerUpdate,
    customer: models.Customer = Depends(auth.get_current_customer),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/orders", response_model=List[schemas.OrderOut])
def my_orders(
    customer: models.Customer = Depends(auth.get_current_customer),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.customer_id == customer.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )
