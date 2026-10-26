from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import pricing, promotions, schemas
from ..database import get_db

router = APIRouter(prefix="/promotions", tags=["Promotions"])


@router.get("", response_model=list[schemas.PromotionPublic])
def list_promotions(db: Session = Depends(get_db)):
    """Cart offers running now — the storefront's offers list. Drafts,
    scheduled, ended, deactivated and used-up offers are never listed."""
    return [
        schemas.PromotionPublic(
            **pricing.promotion_badge(r).model_dump(),
            ends_at=r.ends_at,
            product_ids=sorted(r.eligible_products), category_ids=sorted(r.eligible_categories),
            reward_product_ids=sorted(r.reward_products), reward_category_ids=sorted(r.reward_categories),
        )
        for r in promotions.order_rules(pricing.live_promotions(db))
    ]


@router.get("/{promotion_id}/bundle", response_model=schemas.BundleOffer)
def get_bundle(promotion_id: str, db: Session = Depends(get_db)):
    """A running bundle offer with its products — the offer card's "add the
    whole bundle" data. Anything not running (or not a bundle) is a 404."""
    rule = next((r for r in pricing.live_promotions(db) if r.id == promotion_id and r.type == "bundle"), None)
    if rule is None:
        raise HTTPException(404, "عرض الباقة ده مش متاح دلوقتي")
    return pricing.bundle_offer(db, rule)
