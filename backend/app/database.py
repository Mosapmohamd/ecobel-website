import os
from dotenv import load_dotenv
import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load backend/.env into the real process environment. Without this,
# os.getenv() below only sees actual OS environment variables — a .env
# file sitting next to this code does nothing on its own, and every
# setting quietly falls back to its default (e.g. the local SQLite file)
# with no error, which is exactly the trap this line prevents.
load_dotenv()

# IMPORTANT: this must point at the SAME database as ecobel-accounting-system
# (same DATABASE_URL value in both .env files) — the website reads/writes the
# shared `products`, `categories`, `inventory_movements`, and `finance_entries`
# tables directly rather than calling the accounting system's API.
#
# Default falls back to a local SQLite file for development/testing only.
# In production, set DATABASE_URL to the same PostgreSQL connection string
# used by ecobel-accounting-system (e.g. a Supabase connection string).
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ecobel_dev.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL (incl. Supabase). pool_pre_ping recycles connections that
    # the server dropped (Supabase closes idle ones), and the small bounded
    # pool keeps us well under Supabase's connection cap — especially on the
    # free tier. If you use Supabase's Session Pooler URL (port 6543) these
    # limits still apply harmlessly.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=1800,  # recycle connections after 30 min
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# The shared database's schema is migrated by ecobel-accounting-system
# (its alembic/versions) — this service never creates or alters tables.
# Bump this when a new migration there changes tables this service maps.
EXPECTED_SCHEMA_REVISION = "0003_product_image_key"


def check_schema_revision() -> None:
    """Warns (doesn't crash — both services may start at the same moment)
    when the database isn't at the revision these models expect."""
    log = logging.getLogger("uvicorn.error")
    try:
        with engine.connect() as conn:
            if "alembic_version" not in inspect(conn).get_table_names():
                log.warning("Database has no migration history — start ecobel-accounting-system (it migrates the shared schema).")
                return
            current = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception as exc:  # database unreachable — requests will report it
        log.warning("Could not check the database schema revision: %s", exc)
        return
    if current != EXPECTED_SCHEMA_REVISION:
        log.warning(
            "Database schema is at %s but this service expects %s — run the accounting "
            "system's migrations (alembic upgrade head) or update ecobel-website.",
            current, EXPECTED_SCHEMA_REVISION,
        )
