"""The promotion rules (app/promotions.py) on plain data — no database.
The same module ships in ecobel-accounting-system (its admin preview)."""
from datetime import datetime, timedelta, timezone

import pytest

from app.promotions import BundleGroup, Line, Rule, describe, evaluate_products, evaluate_shipping, schedule_state

NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def rule(type_, config=None, **kw):
    kw.setdefault("id", f"r_{type_}")
    kw.setdefault("eligible_quantities", {})
    kw.setdefault("name", type_)
    kw.setdefault("created_at", T0)
    for key in ("eligible_products", "eligible_categories", "reward_products", "reward_categories"):
        kw[key] = frozenset(kw.get(key, ()))
    return Rule(type=type_, config=config or {}, **kw)


def L(pid, price, qty, cat="c1"):
    return Line(pid, cat, price, qty)


def run(rules, lines, **kw):
    return evaluate_products(rules, lines, now=NOW, **kw)


# ---------------------------------------------------------------- A: bundles
# Bundles come only as whole groups the customer added (never guessed from
# loose items): a CHOOSE bundle (mode "any") of N eligible units, or a FIXED
# bundle (mode "combination") with exact products and quantities.
BUNDLE = {"bundle_quantity": 3, "bundle_price": 600}
FIXED = {"mode": "combination", "bundle_price": 600}


def G(pid_or_items, count=1, rid="r_bundle"):
    items = pid_or_items if isinstance(pid_or_items, list) else [pid_or_items]
    return BundleGroup(rid, items, count)


def test_choose_bundle_costs_the_bundle_price_once_per_bundle():
    r = rule("bundle", BUNDLE)
    res = run([r], [], bundles=[G([L("a", 250, 2), L("b", 300, 1)])])
    o = res.bundles[0]
    assert o.ok and o.normal == 800 and o.price == 600 and o.discount == 200
    assert res.discount == 200 and res.applied[0].detail["bundles"] == 1
    res = run([r], [], bundles=[G([L("a", 250, 3)], count=2)])
    assert res.bundles[0].price == 1200 and res.discount == 300 and res.applied[0].units == {"a": 6}


def test_choose_bundle_needs_exactly_the_configured_number_of_eligible_products():
    r = rule("bundle", BUNDLE, eligible_categories={"skin"})
    assert "3 منتجات" in run([r], [], bundles=[G([L("a", 250, 2, "skin")])]).bundles[0].reason
    assert "3 منتجات" in run([r], [], bundles=[G([L("a", 250, 4, "skin")])]).bundles[0].reason
    bad = run([r], [], bundles=[G([L("a", 250, 2, "skin"), L("h", 200, 1, "hair")])]).bundles[0]
    assert not bad.ok and "مش من منتجات العرض" in bad.reason
    distinct = rule("bundle", {**BUNDLE, "distinct_products": True})
    assert not run([distinct], [], bundles=[G([L("a", 250, 3)], rid=distinct.id)]).bundles[0].ok
    assert run([distinct], [], bundles=[G([L("a", 250, 1), L("b", 250, 1), L("c", 250, 1)], rid=distinct.id)]).bundles[0].ok


def test_fixed_bundle_must_hold_exactly_its_products_and_quantities():
    r = rule("bundle", FIXED, eligible_products={"cleanser", "serum"}, eligible_quantities={"cleanser": 2, "serum": 1})
    ok = run([r], [], bundles=[G([L("cleanser", 150, 2), L("serum", 400, 1)])])
    assert ok.bundles[0].ok and ok.discount == 100
    for items in ([L("cleanser", 150, 1), L("serum", 400, 1)],                       # missing a unit
                  [L("cleanser", 150, 2), L("serum", 400, 1), L("x", 10, 1)],       # extra product
                  [L("serum", 400, 3)]):                                             # swapped contents
        out = run([r], [], bundles=[G(items)]).bundles[0]
        assert not out.ok and "محتوى الباقة" in out.reason
    assert run([r], [], bundles=[G(items)]).discount == 0


def test_bundle_limits_multiple_and_max():
    one = rule("bundle", {**BUNDLE, "allow_multiple": False})
    out = run([one], [], bundles=[G([L("a", 250, 3)], count=2, rid=one.id)])
    assert not out.bundles[0].ok and "أقصى عدد" in out.bundles[0].reason and out.discount == 0
    two = rule("bundle", {**BUNDLE, "max_bundles": 2})
    # the limit counts every group of the offer together
    out = run([two], [], bundles=[G([L("a", 250, 3)], count=2, rid=two.id), G([L("b", 250, 3)], rid=two.id)])
    assert all(not o.ok for o in out.bundles)
    assert run([two], [], bundles=[G([L("a", 250, 3)], count=2, rid=two.id)]).discount == 300


def test_a_bundle_never_costs_more_than_its_products():
    out = run([rule("bundle", BUNDLE)], [], bundles=[G([L("a", 150, 3)])]).bundles[0]
    assert out.ok and out.price == 450 and out.discount == 0


def test_loose_items_never_become_a_bundle_and_get_a_hint():
    res = run([rule("bundle", BUNDLE)], [L("a", 250, 3)])
    assert res.discount == 0 and "أضيفي الباقة كاملة" in res.skipped[0].reason


def test_unknown_inactive_or_unavailable_bundle_offers_are_refused():
    out = run([], [], bundles=[G([L("a", 250, 3)], rid="nope")]).bundles[0]
    assert not out.ok and "مش متاح" in out.reason
    ended = rule("bundle", BUNDLE, ends_at=NOW)
    out = run([ended], [], bundles=[G([L("a", 250, 3)])]).bundles[0]
    assert not out.ok and "مش متاح" in out.reason
    pct = rule("percentage", {"percent": 10})
    assert not run([pct], [], bundles=[G([L("a", 250, 3)], rid=pct.id)]).bundles[0].ok
    # an order that already holds the bundle keeps it after the offer ended
    assert run([ended], [], bundles=[G([L("a", 250, 3)])], held={ended.id}).bundles[0].ok


def test_bundle_minimum_subtotal_counts_the_whole_cart():
    r = rule("bundle", BUNDLE, min_subtotal=1000)
    assert not run([r], [], bundles=[G([L("a", 250, 3)])]).bundles[0].ok
    assert run([r], [L("x", 300, 1)], bundles=[G([L("a", 250, 3)])]).bundles[0].ok


# ---------------------------------------------------------------- C: percentage
def test_percentage_on_eligible_items_only():
    r = rule("percentage", {"percent": 10}, eligible_categories={"skin"})
    res = run([r], [L("a", 200, 2, "skin"), L("b", 500, 1, "hair")])
    assert res.discount == 40 and res.applied[0].allocations == {"a": 40}


def test_percentage_caps():
    assert run([rule("percentage", {"percent": 50, "max_discount": 100})], [L("a", 300, 2)]).discount == 100
    # max eligible quantity: only the 2 dearest units are discounted
    res = run([rule("percentage", {"percent": 10, "max_quantity": 2})], [L("a", 100, 3), L("b", 500, 1)])
    assert res.discount == 60
    # never more than the eligible subtotal
    assert run([rule("percentage", {"percent": 100})], [L("a", 99.99, 1)]).discount == 99.99


# ---------------------------------------------------------------- D: fixed amount
def test_fixed_amount_per_order_never_goes_negative():
    assert run([rule("fixed_amount", {"amount": 50})], [L("a", 200, 1)]).discount == 50
    assert run([rule("fixed_amount", {"amount": 500})], [L("a", 120, 1)]).discount == 120
    r = rule("fixed_amount", {"amount": 500}, eligible_products={"a"})
    assert run([r], [L("a", 120, 1), L("b", 900, 1)]).discount == 120  # only eligible items


def test_fixed_amount_per_item():
    r = rule("fixed_amount", {"amount": 30, "apply_per": "item"})
    assert run([r], [L("a", 200, 2), L("b", 20, 1)]).discount == 30 + 30 + 20
    r = rule("fixed_amount", {"amount": 30, "apply_per": "item", "max_quantity": 2})
    assert run([r], [L("a", 200, 5)]).discount == 60


# ---------------------------------------------------------------- E: buy x get y
def test_buy_two_get_one_cheapest_free_same_pool():
    r = rule("buy_x_get_y", {"buy_quantity": 2, "get_quantity": 1})
    res = run([r], [L("a", 300, 2), L("b", 100, 1)])
    a = res.applied[0]
    assert res.discount == 100 and a.free_units == {"b": 1} and a.units == {"a": 2, "b": 1}


def test_gift_units_are_never_also_qualifying_units():
    r = rule("buy_x_get_y", {"buy_quantity": 2, "get_quantity": 1})
    res = run([r], [L("a", 100, 2)])  # 2 units can't be both "buy 2" and the gift
    assert res.discount == 0 and "1 منتج" in res.skipped[0].reason
    assert run([r], [L("a", 100, 3)]).discount == 100


def test_separate_reward_product_must_be_in_the_cart():
    r = rule("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1}, eligible_products={"a"}, reward_products={"g"})
    res = run([r], [L("a", 300, 1)])
    assert res.discount == 0 and "الهدية" in res.skipped[0].reason
    res = run([r], [L("a", 300, 1), L("g", 80, 1)])
    assert res.discount == 80 and res.applied[0].free_units == {"g": 1}


def test_multiple_rewards_and_max_rewards():
    r = rule("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1}, eligible_products={"a"}, reward_products={"g"})
    assert run([r], [L("a", 300, 3), L("g", 80, 3)]).discount == 240
    r2 = rule("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1, "max_rewards": 2}, eligible_products={"a"}, reward_products={"g"})
    assert run([r2], [L("a", 300, 3), L("g", 80, 3)]).discount == 160
    r3 = rule("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1, "allow_multiple": False}, eligible_products={"a"}, reward_products={"g"})
    assert run([r3], [L("a", 300, 3), L("g", 80, 3)]).discount == 80


def test_reward_choice_most_expensive():
    r = rule("buy_x_get_y", {"buy_quantity": 1, "get_quantity": 1, "reward_choice": "most_expensive"},
             eligible_products={"a"}, reward_products={"g1", "g2"})
    assert run([r], [L("a", 300, 1), L("g1", 50, 1), L("g2", 90, 1)]).discount == 90


# ---------------------------------------------------------------- B: free shipping
def ship(rules, lines, *, fee=40, city="القاهرة", after=None, product_result=None):
    res = product_result or run([], lines)
    subtotal = sum(l.unit_price * l.quantity for l in lines)
    return evaluate_shipping(rules, lines, res, now=NOW, city=city, shipping_fee=fee,
                             subtotal_after_discounts=subtotal if after is None else after)


def test_free_shipping_threshold_before_or_after_discounts():
    after = rule("free_shipping", {"basis": "after"}, min_subtotal=500)
    before = rule("free_shipping", {"basis": "before"}, min_subtotal=500)
    lines = [L("a", 520, 1)]
    assert ship([after], lines, after=480).shipping_discount == 0
    assert "20" in ship([after], lines, after=480).skipped[0].reason
    assert ship([before], lines, after=480).shipping_discount == 40
    assert ship([after], lines, after=520).shipping_discount == 40


def test_free_shipping_cities_and_city_required():
    r = rule("free_shipping", {"cities": ["القاهرة"]})
    assert ship([r], [L("a", 100, 1)]).shipping_discount == 40
    assert ship([r], [L("a", 100, 1)], city="أسوان").shipping_discount == 0
    assert ship([r], [L("a", 100, 1)], city=None, fee=None).shipping_discount == 0


def test_free_shipping_restricted_to_products():
    r = rule("free_shipping", {}, eligible_products={"a"}, min_subtotal=300)
    assert ship([r], [L("b", 900, 1)]).shipping_discount == 0          # no eligible item
    assert ship([r], [L("a", 200, 1), L("b", 900, 1)]).shipping_discount == 0  # eligible part below 300
    assert ship([r], [L("a", 300, 1), L("b", 900, 1)]).shipping_discount == 40
    every = rule("free_shipping", {"require_all_eligible": True}, eligible_products={"a"})
    assert ship([every], [L("a", 300, 1), L("b", 1, 1)]).shipping_discount == 0
    assert ship([every], [L("a", 300, 1)]).shipping_discount == 40


def test_free_shipping_waives_one_fee_once():
    r1, r2 = rule("free_shipping", {}, id="f1", combinable=True), rule("free_shipping", {}, id="f2", combinable=True)
    res = ship([r1, r2], [L("a", 100, 1)])
    assert res.shipping_discount == 40 and len(res.applied) == 1
    assert ship([r1], [L("a", 100, 1)], fee=0).applied == []  # already free: nothing applied or counted


# ---------------------------------------------------------------- availability
@pytest.mark.parametrize("kw,state", [
    ({"status": "draft"}, "draft"),
    ({"status": "inactive"}, "inactive"),
    ({"starts_at": NOW + timedelta(days=1)}, "scheduled"),
    ({"ends_at": NOW}, "expired"),
    ({"starts_at": NOW - timedelta(days=1), "ends_at": NOW + timedelta(days=1)}, "active"),
])
def test_only_running_offers_apply(kw, state):
    r = rule("percentage", {"percent": 10}, **kw)
    assert schedule_state(r, NOW) == state
    res = run([r], [L("a", 100, 1)])
    assert (res.discount == 10) == (state == "active")
    if state != "active":
        assert res.skipped[0].kind == "unavailable"


def test_usage_and_per_customer_limits():
    r = rule("percentage", {"percent": 10}, usage_limit=5, used_count=5)
    assert run([r], [L("a", 100, 1)]).discount == 0
    r = rule("percentage", {"percent": 10}, per_customer_limit=1)
    assert run([r], [L("a", 100, 1)], customer_uses={r.id: 1}).discount == 0
    assert run([r], [L("a", 100, 1)], customer_uses={}).discount == 10
    assert run([r], [L("a", 100, 1)], customer_uses=None).discount == 10  # unknown shopper: checked at checkout


def test_an_order_keeps_offers_it_holds_but_conditions_are_rechecked():
    r = rule("percentage", {"percent": 10}, status="inactive", min_subtotal=100, usage_limit=1, used_count=1)
    assert run([r], [L("a", 100, 1)], held={r.id}).discount == 10
    assert run([r], [L("a", 50, 1)], held={r.id}).discount == 0


def test_minimum_subtotal():
    r = rule("fixed_amount", {"amount": 50}, min_subtotal=300)
    res = run([r], [L("a", 250, 1)])
    assert res.discount == 0 and "50" in res.skipped[0].reason
    assert run([r], [L("a", 300, 1)]).discount == 50


# ---------------------------------------------------------------- priority & combination
def test_non_combinable_offers_higher_priority_wins():
    low = rule("percentage", {"percent": 50}, id="low", priority=1)
    high = rule("percentage", {"percent": 10}, id="high", priority=5)
    res = run([low, high], [L("a", 100, 1)])
    assert [a.rule.id for a in res.applied] == ["high"] and res.discount == 10
    assert res.skipped[0].kind == "conflict"


def test_ties_are_broken_by_age_then_id():
    a = rule("percentage", {"percent": 10}, id="b_newer", created_at=T0 + timedelta(days=1))
    b = rule("percentage", {"percent": 20}, id="a_older", created_at=T0)
    assert run([a, b], [L("a", 100, 1)]).applied[0].rule.id == "a_older"
    c = rule("percentage", {"percent": 10}, id="z")
    d = rule("percentage", {"percent": 20}, id="y")
    assert run([c, d], [L("a", 100, 1)]).applied[0].rule.id == "y"


def test_combinable_offers_never_discount_the_same_unit_twice():
    bundle = rule("bundle", BUNDLE, id="bundle", priority=2, combinable=True)
    pct = rule("percentage", {"percent": 10}, id="pct", priority=1, combinable=True)
    # units inside the bundle are never seen by the % offer; the loose one is
    res = run([bundle, pct], [L("a", 250, 1)], bundles=[G([L("a", 250, 3)], rid="bundle")])
    assert res.applied[0].units == {"a": 3} and res.applied[1].units == {"a": 1}
    assert res.discount == 150 + 25


def test_a_non_combinable_bundle_blocks_other_offers_and_conflicting_bundles():
    solo = rule("bundle", BUNDLE, id="solo", priority=5)
    pct = rule("percentage", {"percent": 10}, id="pct", priority=1, combinable=True)
    res = run([solo, pct], [L("x", 100, 1)], bundles=[G([L("a", 250, 3)], rid="solo")])
    assert [a.rule.id for a in res.applied] == ["solo"]
    other = rule("bundle", BUNDLE, id="other", priority=1, combinable=True)
    res = run([solo, other], [], bundles=[G([L("a", 250, 3)], rid="solo"), G([L("b", 250, 3)], rid="other")])
    assert res.bundles[0].ok and not res.bundles[1].ok and "ما بيتجمعش" in res.bundles[1].reason


def test_a_non_combinable_offer_does_not_join_combinable_ones():
    first = rule("percentage", {"percent": 10}, id="first", priority=2, combinable=True)
    solo = rule("fixed_amount", {"amount": 5}, id="solo", priority=1)
    res = run([first, solo], [L("a", 100, 2)])
    assert [a.rule.id for a in res.applied] == ["first"]
    ship_solo = rule("free_shipping", {}, id="fs")
    assert ship([ship_solo], [L("a", 100, 2)], product_result=res).shipping_discount == 0


def test_allocations_add_up_to_the_cent():
    r = rule("bundle", {"bundle_quantity": 3, "bundle_price": 100})
    res = run([r], [], bundles=[G([L("a", 33.33, 1), L("b", 66.67, 1), L("c", 10.01, 1)])])
    a = res.applied[0]
    assert a.discount == 10.01 and round(sum(a.allocations.values()), 2) == 10.01


def test_descriptions():
    assert describe(rule("bundle", BUNDLE)) == "اختاري 3 منتجات بـ 600 ج.م"
    fixed = rule("bundle", FIXED, eligible_products={"a", "b"}, eligible_quantities={"a": 2})
    assert describe(fixed) == "باقة 3 منتجات بـ 600 ج.م"
    assert describe(rule("free_shipping", {}, min_subtotal=750)) == "شحن مجاني للطلبات من 750 ج.م"
    assert describe(rule("buy_x_get_y", {"buy_quantity": 2, "get_quantity": 1})) == "اشتري 2 وخدي 1 هدية"
