"""The public announcement bar (/storefront/announcement-bar): defaults
until staff save settings, saved settings as configured, and anything
invalid or empty hidden rather than broken — on a throwaway SQLite DB."""
import os
import sys
import tempfile

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

models.Base.metadata.create_all(bind=engine)
client = TestClient(app)
URL = "/storefront/announcement-bar"


@pytest.fixture(autouse=True)
def clean():
    yield
    db = SessionLocal()
    db.query(models.StorefrontSetting).delete()
    db.commit()
    db.close()


def save(value):
    db = SessionLocal()
    db.merge(models.StorefrontSetting(key="announcement_bar", value=value))
    db.commit()
    db.close()


def test_default_bar_until_settings_are_saved():
    bar = client.get(URL).json()
    assert bar["enabled"] is True and bar["text_ar"] == "أهلاً بكم في EcoBel" and bar["scrolling"] is True


def test_saved_arabic_and_english_settings_are_served():
    save({"enabled": True, "text_ar": "خصم ٢٠٪ على الشعر", "text_en": "20% off hair care", "scrolling": False,
          "direction": "right", "speed": "slow", "visibility": "desktop", "theme": "light", "link_url": "/products"})
    bar = client.get(URL).json()
    assert bar["text_ar"] == "خصم ٢٠٪ على الشعر" and bar["text_en"] == "20% off hair care"
    assert (bar["scrolling"], bar["direction"], bar["speed"], bar["visibility"], bar["theme"]) == (False, "right", "slow", "desktop", "light")


def test_disabled_bar_is_served_as_disabled():
    save({"enabled": False, "text_ar": "نص"})
    assert client.get(URL).json()["enabled"] is False


@pytest.mark.parametrize("value", [
    {"enabled": True, "text_ar": "<img src=x onerror=alert(1)>"},  # saved around the admin API
    {"enabled": True, "text_ar": "ok", "link_url": "javascript:alert(1)"},
    {"enabled": True, "text_ar": "ok", "theme": "url(evil)"},
])
def test_invalid_saved_settings_hide_the_bar(value):
    save(value)
    bar = client.get(URL).json()
    assert bar["enabled"] is False and bar["text_ar"] is None


def test_enabled_without_text_is_hidden():
    save({"enabled": True, "text_ar": "  ", "text_en": None})
    assert client.get(URL).json()["enabled"] is False
