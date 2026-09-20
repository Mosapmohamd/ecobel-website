import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# IMPORTANT: this must point at the SAME database as ecobel-accounting-system
# (same DATABASE_URL value in both .env files) — the website reads/writes the
# shared `products`, `categories`, `inventory_movements`, and `finance_entries`
# tables directly rather than calling the accounting system's API.
#
# Default falls back to a local SQLite file for development/testing only.
# In production, set DATABASE_URL to the same PostgreSQL connection string
# used by ecobel-accounting-system.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ecobel_dev.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
