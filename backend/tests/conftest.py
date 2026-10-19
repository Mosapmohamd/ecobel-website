"""Shared test configuration.

Every request in these tests comes from the same test-client address and
many reuse a handful of phone numbers, so the guest checkout limits
(app/abuse_limits.py, guests and accounts) would trip across unrelated tests. They're raised
here for general tests only; tests/test_guest_order_limits.py sets the
real production defaults explicitly and checks them.
"""
import pytest


@pytest.fixture(autouse=True)
def generous_guest_limits(monkeypatch):
    from app import abuse_limits  # imported lazily: test modules bind the DB first

    monkeypatch.setattr(abuse_limits, "PENDING_PER_PHONE", 10_000)
    monkeypatch.setattr(abuse_limits, "PENDING_PER_ACCOUNT", 10_000)
    monkeypatch.setattr(abuse_limits, "PER_IP_PER_DAY", 10_000)
