"""Behind the hosting proxy every visitor keeps their own rate limits, and
X-Forwarded-For is only trusted from the proxy ranges in render.yaml's start
command — so a client can't fake a fresh address per request."""
import os
import re
import sys
import tempfile
from pathlib import Path

if "app.database" not in sys.modules:
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
    os.environ.pop("SECRET_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware  # noqa: E402

from app import models  # noqa: E402
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

models.Base.metadata.create_all(bind=engine)

RENDER = Path(__file__).resolve().parents[2] / "render.yaml"


def trusted_ranges() -> str:
    m = re.search(r'--forwarded-allow-ips "([^"]+)"', RENDER.read_text(encoding="utf-8"))
    assert m and m.group(1) != "*", "render.yaml must trust only the proxy's private ranges"
    return m.group(1)


@pytest.fixture(autouse=True)
def fresh_limits():
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.reset()


def attempts(client, xffs, phone):
    # A different phone per test, so the per-account throttle isn't what trips.
    return [client.post("/account/login", json={"phone": phone, "password": "wrong-pass-1"},
                        headers={"X-Forwarded-For": x}).status_code for x in xffs]


def test_visitors_behind_the_balancer_keep_their_own_limits():
    lb = TestClient(ProxyHeadersMiddleware(app, trusted_hosts=trusted_ranges()), client=("10.0.0.5", 40000))
    # Visitor A, faking a different left-hand address each time, still hits their own limit…
    assert attempts(lb, [f"6.6.6.{n}, 203.0.113.20" for n in range(6)], "01090000001") == [401] * 5 + [429]
    # …and visitor B behind the same balancer is unaffected.
    assert attempts(lb, ["203.0.113.21"], "01090000002") == [401]


def test_forwarded_headers_from_untrusted_clients_are_ignored():
    direct = TestClient(ProxyHeadersMiddleware(app, trusted_hosts=trusted_ranges()), client=("198.51.100.200", 40000))
    assert attempts(direct, [f"203.0.113.{100 + n}" for n in range(6)], "01090000003") == [401] * 5 + [429]
