"""Production hardening: startup checks, docs switch, response headers."""
import importlib
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import security  # noqa: E402
from app.main import app  # noqa: E402

GOOD_SECRET = "x" * 48
GOOD_DB = "postgresql://db.example:5432/app"


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    importlib.reload(security)
    yield security
    monkeypatch.delenv("ENVIRONMENT")
    importlib.reload(security)


def test_development_is_the_default_and_keeps_docs():
    assert not security.IS_PRODUCTION and security.DOCS_SETTINGS == {}
    security.check_production_config("short", ["http://localhost:3000"], "sqlite:///./dev.db")  # never blocks local work


def test_production_disables_api_docs(production):
    assert production.DOCS_SETTINGS == {"docs_url": None, "redoc_url": None, "openapi_url": None}


@pytest.mark.parametrize("secret,origins,db,fragment", [
    ("too-short", ["https://shop.example"], GOOD_DB, "SECRET_KEY"),
    (GOOD_SECRET, ["http://localhost:3000"], GOOD_DB, "FRONTEND_ORIGINS"),
    (GOOD_SECRET, ["http://shop.example"], GOOD_DB, "FRONTEND_ORIGINS"),
    (GOOD_SECRET, [], GOOD_DB, "FRONTEND_ORIGINS"),
    (GOOD_SECRET, ["https://shop.example"], "sqlite:///./ecobel_dev.db", "DATABASE_URL"),
])
def test_production_refuses_unsafe_settings(production, secret, origins, db, fragment):
    with pytest.raises(RuntimeError, match=fragment):
        production.check_production_config(secret, origins, db)


def test_production_accepts_safe_settings(production):
    production.check_production_config(GOOD_SECRET, ["https://shop.example"], GOOD_DB)


def test_every_response_carries_security_headers():
    res = TestClient(app).get("/")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["cache-control"] == "no-store"
