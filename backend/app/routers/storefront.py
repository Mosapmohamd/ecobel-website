import logging

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/storefront", tags=["Storefront"])
log = logging.getLogger("uvicorn.error")


@router.get("/announcement-bar", response_model=schemas.AnnouncementBar)
def announcement_bar(db: Session = Depends(get_db)):
    """The top announcement bar as staff configured it in the accounting
    system (storefront_settings) — validated again here, so the storefront
    only ever renders plain text and a safe link. Nothing saved yet → the
    default bar. Invalid saved data → the bar is hidden, not broken."""
    row = db.get(models.StorefrontSetting, "announcement_bar")
    if row is None or not row.value:
        return schemas.AnnouncementBar()
    try:
        bar = schemas.AnnouncementBar.model_validate(row.value)
    except ValidationError:
        log.warning("Ignoring invalid announcement_bar settings")
        return schemas.AnnouncementBar(enabled=False, text_ar=None)
    if not bar.has_text:
        bar.enabled = False
    return bar
