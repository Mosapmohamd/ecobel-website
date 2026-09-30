from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db
from ..rate_limit import limiter

router = APIRouter(prefix="/products/{product_id}/reviews", tags=["Reviews"])


def _has_purchased(db: Session, customer_id: str, product_id: str) -> bool:
    """A customer is eligible to review a product only if they have at
    least one non-cancelled order containing it — checked server-side,
    never trusted from the client."""
    return (
        db.query(models.OrderItem)
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .filter(models.Order.customer_id == customer_id)
        .filter(models.Order.status != models.OrderStatus.cancelled)
        .filter(models.OrderItem.product_id == product_id)
        .first()
        is not None
    )


@router.get("/", response_model=schemas.ReviewSummary)
def list_reviews(product_id: str, db: Session = Depends(get_db)):
    """Public — only approved reviews are ever returned here."""
    q = (
        db.query(models.Review)
        .filter(models.Review.product_id == product_id)
        .filter(models.Review.is_approved == True)  # noqa: E712
        .order_by(models.Review.created_at.desc())
    )
    reviews = q.all()
    avg = db.query(func.avg(models.Review.rating)).filter(
        models.Review.product_id == product_id, models.Review.is_approved == True  # noqa: E712
    ).scalar()
    return schemas.ReviewSummary(
        average_rating=round(avg, 1) if avg else 0.0,
        review_count=len(reviews),
        reviews=reviews,
    )


@router.get("/eligibility", response_model=schemas.ReviewEligibility)
def check_eligibility(
    product_id: str,
    db: Session = Depends(get_db),
    customer: models.Customer = Depends(auth.get_current_customer),
):
    if not _has_purchased(db, customer.id, product_id):
        return schemas.ReviewEligibility(can_review=False, reason="لازم تكوني طلبتي المنتج ده الأول عشان تقيّميه")
    already = (
        db.query(models.Review)
        .filter(models.Review.customer_id == customer.id, models.Review.product_id == product_id)
        .first()
    )
    if already:
        return schemas.ReviewEligibility(can_review=False, reason="قيّمتي المنتج ده قبل كده")
    return schemas.ReviewEligibility(can_review=True)


@router.post("/", response_model=schemas.ReviewOut, status_code=201)
@limiter.limit("5/minute")
def create_review(
    request: Request,
    product_id: str,
    payload: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    customer: models.Customer = Depends(auth.get_current_customer),
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(404, "المنتج غير موجود")
    if not _has_purchased(db, customer.id, product_id):
        raise HTTPException(403, "لازم تكوني طلبتي المنتج ده الأول عشان تقيّميه")
    existing = (
        db.query(models.Review)
        .filter(models.Review.customer_id == customer.id, models.Review.product_id == product_id)
        .first()
    )
    if existing:
        raise HTTPException(400, "قيّمتي المنتج ده قبل كده")

    review = models.Review(
        product_id=product_id,
        customer_id=customer.id,
        rating=payload.rating,
        comment=payload.comment,
        is_approved=False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
