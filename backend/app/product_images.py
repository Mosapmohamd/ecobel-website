"""Public URLs for product photos.

The database stores each photo's storage key ("products/<id>/<random>.<ext>");
ecobel-accounting-system uploads and deletes the objects (see its
app/product_images.py). This service only turns a key into the public URL,
from the same configuration:

    SUPABASE_URL           https://<project-ref>.supabase.co
    PRODUCT_IMAGES_BUCKET  optional, default "product-images"
    PRODUCT_IMAGE_BASE_URL optional override of the public base URL (e.g. a CDN)

No secret key is needed or used here.
"""
import os

from dotenv import load_dotenv

load_dotenv()

_SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
_BUCKET = os.getenv("PRODUCT_IMAGES_BUCKET", "product-images")
PUBLIC_BASE_URL = (
    os.getenv("PRODUCT_IMAGE_BASE_URL")
    or (f"{_SUPABASE_URL}/storage/v1/object/public/{_BUCKET}" if _SUPABASE_URL else "")
).rstrip("/")


def public_url(key: str | None) -> str | None:
    if not key or not PUBLIC_BASE_URL:
        return None
    return f"{PUBLIC_BASE_URL}/{key}"
