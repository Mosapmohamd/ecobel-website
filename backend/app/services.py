from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models


def apply_stock_movement(
    db: Session,
    product: models.Product,
    quantity_change: int,
    movement_type: models.MovementType,
    reference_id: str | None = None,
    note: str | None = None,
) -> models.InventoryMovement:
    """Same rule as the accounting system: never let a sale take stock
    negative. (Website checkout never passes allow_negative — only manual
    corrections in the accounting system's /inventory/adjust do that.)"""
    new_quantity = product.quantity + quantity_change
    if new_quantity < 0:
        raise HTTPException(
            400,
            f"الكمية المتاحة من '{product.name}' غير كافية "
            f"(المتاح: {product.quantity}, المطلوب: {abs(quantity_change)})",
        )

    product.quantity = new_quantity
    movement = models.InventoryMovement(
        product_id=product.id,
        type=movement_type,
        quantity_change=quantity_change,
        reference_id=reference_id,
        note=note,
    )
    db.add(movement)
    return movement
