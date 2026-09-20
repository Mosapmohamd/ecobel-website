"""
LOCAL DEVELOPMENT ONLY — not part of the real migration path.

This service's Alembic migration deliberately does NOT create the shared
tables (`categories`, `products`, `inventory_movements`, `finance_entries`)
because ecobel-accounting-system owns them in production.

If you're working on this service by itself (no real shared Postgres
database set up yet), run this once against your local DATABASE_URL to
create just those shared tables so the website's endpoints have something
to query:

    python dev_bootstrap_shared_tables.py

In any real environment, skip this entirely — run
ecobel-accounting-system's `alembic upgrade head` against the shared
database instead, which creates these same tables for real.
"""
from app.database import engine
from app.models import Category, Product, InventoryMovement, FinanceEntry, Base

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine, tables=[
        Category.__table__,
        Product.__table__,
        InventoryMovement.__table__,
        FinanceEntry.__table__,
    ])
    print("Created shared tables (categories, products, inventory_movements, "
          "finance_entries) for local testing.")
