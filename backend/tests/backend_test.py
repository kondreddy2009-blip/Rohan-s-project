"""Table backend API tests (post-pivot from Nocturne/Ritual to Table restaurants)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

ADMIN = {"email": "bhandariyashvee@gmail.com", "password": "ritual2026"}
ALEX = {"email": "alex@ritual.app", "password": "ritual2026"}
MILA = {"email": "mila@ritual.app", "password": "ritual2026"}
# staff.lumen is now mapped to venue-ikigai per seed; staff.verre → venue-verre
STAFF_IKIGAI = {"email": "staff.lumen@ritual.app", "password": "ritual2026"}
STAFF_VERRE = {"email": "staff.verre@ritual.app", "password": "ritual2026"}

EXPECTED_VENUE_IDS = {
    "venue-verre", "venue-osteria", "venue-ikigai",
    "venue-salle-privee", "venue-la-petite", "venue-chambre",
}
LEGACY_VENUE_IDS = {"venue-lumen", "venue-noctis", "venue-aureole", "venue-aureus"}


def _session(creds=None):
    s = requests.Session()
    if creds:
        r = s.post(f"{API}/auth/login", json=creds, timeout=15)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


def _reward_id(venue_id, name, cost=150, tier="Guest"):
    """Return the id of a venue reward by name, having the venue's staff create it if missing."""
    ss = _session(STAFF_VERRE)
    cfg = ss.get(f"{API}/venues/{venue_id}/loyalty", timeout=10).json()["config"]
    for r in cfg["rewards"]:
        if r["name"] == name:
            return r["id"]
    rewards = cfg["rewards"] + [{"name": name, "cost": cost, "tier_required": tier}]
    r = ss.patch(f"{API}/staff/venues/{venue_id}/loyalty", json={
        "points_per_checkin": cfg["points_per_checkin"],
        "points_per_booking": cfg["points_per_booking"],
        "rewards": rewards,
    }, timeout=10)
    assert r.status_code == 200, r.text
    cfg = ss.get(f"{API}/venues/{venue_id}/loyalty", timeout=10).json()["config"]
    return next(x["id"] for x in cfg["rewards"] if x["name"] == name)


# --- Auth ---
class TestAuth:
    def test_login_admin_and_me(self):
        s = _session(ADMIN)
        r = s.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN["email"]
        assert d["role"] == "admin"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_logout_clears_cookies(self):
        s = _session(ADMIN)
        r = s.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code == 200
        s.cookies.clear()
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 401

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_staff_login(self):
        s = _session(STAFF_VERRE)
        r = s.get(f"{API}/auth/me", timeout=10)
        d = r.json()
        assert d["role"] == "staff"
        assert d["staff_venue_id"] == "venue-verre"


# --- Venues (post-pivot: restaurants) ---
class TestVenues:
    def test_list_venues_exactly_six_restaurants(self):
        r = requests.get(f"{API}/venues", timeout=10)
        assert r.status_code == 200
        venues = r.json()
        assert len(venues) == 6
        ids = {v["id"] for v in venues}
        assert ids == EXPECTED_VENUE_IDS, f"unexpected venue set: {ids}"
        # No legacy Nocturne venues
        assert ids.isdisjoint(LEGACY_VENUE_IDS)

    def test_venues_have_restaurant_fields(self):
        venues = requests.get(f"{API}/venues", timeout=10).json()
        for v in venues:
            assert v["type"] == "Restaurant"
            assert v.get("cuisine")
            assert isinstance(v.get("price_level"), int) and 1 <= v["price_level"] <= 4
            assert v.get("chef")
            assert isinstance(v.get("vibes"), list) and len(v["vibes"]) >= 1
            assert v.get("tagline")

    def test_venue_detail_verre(self):
        r = requests.get(f"{API}/venues/venue-verre", timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["name"] == "Verre"
        assert v["cuisine"] == "French Bistro"
        assert v["chef"] == "Camille Roux"
        assert "signature_offerings" in v
        assert "events" in v and isinstance(v["events"], list)

    def test_venue_404(self):
        r = requests.get(f"{API}/venues/nonexistent", timeout=10)
        assert r.status_code == 404

    def test_legacy_venue_404(self):
        # These should have been purged on startup
        r = requests.get(f"{API}/venues/venue-lumen", timeout=10)
        assert r.status_code == 404


# --- Checkin & Wallet & Redeem (E2E, using post-pivot venue IDs) ---
class TestCheckInAndRedeem:
    def test_e2e_admin_checkin_redeem(self):
        s = _session(ADMIN)
        w0 = s.get(f"{API}/wallet", timeout=10).json()
        balance0 = w0["balance"]

        # Check in at Verre
        r = s.post(f"{API}/venues/venue-verre/checkin", json={}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["points_earned"] == 100
        assert data["balance"] == balance0 + 100
        checkin_id = data["checkin_id"]

        # Feedback
        fb = s.post(f"{API}/checkins/feedback", json={
            "checkin_id": checkin_id,
            "item_ordered": "Beef Tartare",
            "would_return": True,
        }, timeout=10)
        assert fb.status_code == 200

        w1 = s.get(f"{API}/wallet", timeout=10).json()
        assert w1["balance"] == balance0 + 100
        assert w1["ledger"][0]["type"] == "earn"

        # Redeem Free Dessert (150) at Verre
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-verre",
            "reward_id": _reward_id("venue-verre", "Free Dessert"),
        }, timeout=10)
        assert r.status_code == 200, r.text
        red = r.json()
        assert red["balance"] == balance0 + 100 - 150
        assert red["redemption"]["code"].startswith("R-")
        assert red["redemption"]["venue_id"] == "venue-verre"

        r = s.get(f"{API}/wallet/redemptions", timeout=10)
        assert r.status_code == 200
        assert any(x["code"] == red["redemption"]["code"] for x in r.json())

    def test_tier_gate_regular_cannot_inner_experience(self):
        s = _session(ALEX)
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-verre",
            "reward_id": _reward_id("venue-verre", "Inner Circle Experience", 1000, "Insider"),
        }, timeout=10)
        assert r.status_code == 403

    def test_mila_inner_circle_can_redeem_inner_experience(self):
        s = _session(MILA)
        wallet = s.get(f"{API}/wallet", timeout=10).json()
        if wallet["balance"] < 1000:
            pytest.skip("mila balance insufficient")
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-verre",
            "reward_id": _reward_id("venue-verre", "Inner Circle Experience", 1000, "Insider"),
        }, timeout=10)
        assert r.status_code == 200

    def test_points_only_redeemable_at_earning_restaurant(self):
        s = _session(ALEX)
        wallet = s.get(f"{API}/wallet", timeout=10).json()
        held = {v["venue_id"]: v["balance"] for v in wallet["venues"]}
        assert held, "alex should hold points at at least one restaurant"
        assert sum(held.values()) <= wallet["balance"]
        # A restaurant where Alex has earned nothing can't honour his points, however large his total is.
        other = next(v for v in ("venue-chambre", "venue-osteria", "venue-ikigai") if v not in held)
        r = s.post(f"{API}/wallet/redeem", json={"venue_id": other, "reward_id": _reward_id("venue-verre", "Free Dessert")}, timeout=10)
        assert r.status_code == 400, r.text
        assert "where you earned" in r.json()["detail"]

    def test_perks_come_from_the_restaurant(self):
        rid = _reward_id("venue-verre", "Free Dessert")
        ss = _session(STAFF_VERRE)
        cfg = ss.get(f"{API}/venues/venue-verre/loyalty", timeout=10).json()["config"]
        assert rid in [r["id"] for r in cfg["rewards"]]
        r = requests.get(f"{API}/perks", timeout=10)
        assert r.status_code == 404


# --- Staff ---
class TestStaff:
    def test_staff_venues_scoped(self):
        s = _session(STAFF_VERRE)
        r = s.get(f"{API}/staff/venues", timeout=10)
        assert r.status_code == 200
        vs = r.json()
        assert len(vs) == 1
        assert vs[0]["id"] == "venue-verre"

    def test_staff_status_update(self):
        s = _session(STAFF_VERRE)
        r = s.patch(f"{API}/staff/venues/venue-verre/status", json={"status": "Filling In"}, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-verre", timeout=10).json()
        assert v["status"] == "Filling In"

    def test_staff_cannot_update_other_venue(self):
        s = _session(STAFF_VERRE)
        r = s.patch(f"{API}/staff/venues/venue-ikigai/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403

    def test_member_cannot_access_staff(self):
        s = _session(ALEX)
        r = s.patch(f"{API}/staff/venues/venue-verre/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403
        r2 = s.get(f"{API}/staff/venues", timeout=10)
        assert r2.status_code == 403

    def test_staff_analytics(self):
        s = _session(STAFF_VERRE)
        r = s.get(f"{API}/staff/venues/venue-verre/analytics", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("checkins_week", "points_issued", "points_redeemed", "top_offerings"):
            assert k in d

    def test_staff_create_event(self):
        s = _session(STAFF_VERRE)
        r = s.post(f"{API}/staff/venues/venue-verre/events", json={
            "title": "TEST_Event",
            "description": "A test event",
            "date": "2026-04-01",
            "time": "20:00",
            "tier_required": "Regular",
        }, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-verre", timeout=10).json()
        assert any(e["title"] == "TEST_Event" for e in v["events"])

    def test_staff_redemptions(self):
        s = _session(STAFF_VERRE)
        r = s.get(f"{API}/staff/venues/venue-verre/redemptions", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Concierge ---
class TestConcierge:
    def test_member_create_and_get_concierge(self):
        s = _session(MILA)
        r = s.post(f"{API}/venues/venue-verre/concierge", json={
            "message": "TEST_A quiet corner if possible.",
            "request_type": "hold_table",
            "party_size": 2,
            "arrival_time": "21:30",
        }, timeout=10)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["status"] == "pending"
        assert msg["venue_id"] == "venue-verre"
        assert msg["request_type"] == "hold_table"
        assert msg["party_size"] == 2
        msg_id = msg["id"]

        r2 = s.get(f"{API}/members/me/concierge", timeout=10)
        assert r2.status_code == 200
        assert any(x["id"] == msg_id for x in r2.json())

    def test_venue_not_found(self):
        s = _session(MILA)
        r = s.post(f"{API}/venues/nonexistent/concierge", json={
            "message": "hi", "request_type": "request"
        }, timeout=10)
        assert r.status_code == 404

    def test_staff_cannot_create_concierge(self):
        s = _session(STAFF_VERRE)
        r = s.post(f"{API}/venues/venue-verre/concierge", json={
            "message": "hi", "request_type": "request"
        }, timeout=10)
        assert r.status_code == 403

    def test_staff_inbox_and_cross_venue_403(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-verre/concierge", json={
            "message": "TEST_preview please", "request_type": "preview_menu"
        }, timeout=10)
        assert r.status_code == 200
        msg_id = r.json()["id"]

        # Verre staff sees it
        ss = _session(STAFF_VERRE)
        r2 = ss.get(f"{API}/staff/venues/venue-verre/concierge", timeout=10)
        assert r2.status_code == 200
        assert any(x["id"] == msg_id for x in r2.json())

        # Ikigai staff must NOT access Verre inbox
        si = _session(STAFF_IKIGAI)
        r3 = si.get(f"{API}/staff/venues/venue-verre/concierge", timeout=10)
        assert r3.status_code == 403

        r4 = si.patch(f"{API}/staff/concierge/{msg_id}", json={"status": "acknowledged"}, timeout=10)
        assert r4.status_code == 403

    def test_staff_update_concierge_status(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-verre/concierge", json={
            "message": "TEST_update flow", "request_type": "request"
        }, timeout=10)
        msg_id = r.json()["id"]

        ss = _session(STAFF_VERRE)
        r2 = ss.patch(f"{API}/staff/concierge/{msg_id}", json={
            "status": "acknowledged", "response": "We have you noted."
        }, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "acknowledged"

        items = sm.get(f"{API}/members/me/concierge", timeout=10).json()
        matched = next((x for x in items if x["id"] == msg_id), None)
        assert matched is not None
        assert matched["response"] == "We have you noted."

        r3 = ss.patch(f"{API}/staff/concierge/{msg_id}", json={"status": "fulfilled"}, timeout=10)
        assert r3.status_code == 200

    def test_update_nonexistent_msg(self):
        ss = _session(STAFF_VERRE)
        r = ss.patch(f"{API}/staff/concierge/nonexistent-id", json={"status": "acknowledged"}, timeout=10)
        assert r.status_code == 404


# --- Regression: tier gate 403 before 400 balance ---
class TestTierGateOrdering:
    def test_regular_low_balance_gets_403_not_400(self):
        s = _session(ALEX)
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-verre", "reward_id": _reward_id("venue-verre", "Inner Circle Experience", 1000, "Insider")
        }, timeout=10)
        assert r.status_code == 403



# --- Bookings (new iter 4) ---
import datetime as _dt
import re as _re


def _future_date(days=14):
    return (_dt.date.today() + _dt.timedelta(days=days)).isoformat()


class TestBookings:
    def test_availability_shape_and_slots(self):
        s = _session(MILA)
        date = _future_date(14)
        r = s.get(f"{API}/venues/venue-verre/availability", params={"date": date}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["venue_id"] == "venue-verre"
        assert data["date"] == date
        slots = data["slots"]
        assert isinstance(slots, list) and len(slots) > 0
        # Verre hours "18:00 – 01:00" -> last slot 30 min before close => 00:30
        # Count depends on parse; must include half-hour cadence
        times = [s_["time"] for s_ in slots]
        assert times[0] == "18:00"
        assert all(_re.match(r"^\d{2}:\d{2}$", t) for t in times)
        for s_ in slots:
            assert "remaining" in s_ and "available" in s_
            assert isinstance(s_["remaining"], int)
            assert isinstance(s_["available"], bool)

    def test_availability_requires_auth(self):
        r = requests.get(f"{API}/venues/venue-verre/availability", params={"date": _future_date()}, timeout=10)
        assert r.status_code == 401

    def test_availability_bad_venue(self):
        s = _session(MILA)
        r = s.get(f"{API}/venues/nope/availability", params={"date": _future_date()}, timeout=10)
        assert r.status_code == 404

    def test_create_booking_returns_T_code(self):
        s = _session(MILA)
        date = _future_date(21)
        payload = {"venue_id": "venue-verre", "date": date, "time": "19:30",
                   "party_size": 2, "note": "TEST_window seat"}
        r = s.post(f"{API}/bookings", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert _re.match(r"^T-[A-Z2-9]{6}$", b["code"]), f"bad code {b['code']}"
        # No lookalikes (I, L, O, 0, 1)
        assert not any(c in b["code"][2:] for c in "ILO01")
        assert b["status"] == "pending"
        assert b["venue_name"] == "Verre"
        assert b["venue_image"]
        assert b["member_name"]
        assert b["party_size"] == 2
        assert b["note"] == "TEST_window seat"

        # Appears in my bookings, newest first
        r2 = s.get(f"{API}/members/me/bookings", timeout=10)
        assert r2.status_code == 200
        arr = r2.json()
        assert arr[0]["id"] == b["id"]

    def test_invalid_time_rejected(self):
        s = _session(MILA)
        r = s.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": _future_date(22),
            "time": "10:00", "party_size": 2,
        }, timeout=10)
        assert r.status_code == 400

    def test_slot_capacity_6_then_409(self):
        # Fill a slot with 6 pending bookings across mila (6 dupes) — API allows same user multiple
        s = _session(MILA)
        date = _future_date(30)
        time = "20:00"
        codes = []
        for i in range(6):
            r = s.post(f"{API}/bookings", json={
                "venue_id": "venue-verre", "date": date, "time": time, "party_size": 2,
            }, timeout=10)
            assert r.status_code == 200, f"slot fill {i} failed: {r.text}"
            codes.append(r.json()["code"])
        # 7th must 409
        r7 = s.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": date, "time": time, "party_size": 2,
        }, timeout=10)
        assert r7.status_code == 409
        assert "full" in r7.json()["detail"].lower()

        # availability shows available=false, remaining=0 for that time
        av = s.get(f"{API}/venues/venue-verre/availability", params={"date": date}, timeout=10).json()
        slot = next(x for x in av["slots"] if x["time"] == time)
        assert slot["available"] is False
        assert slot["remaining"] == 0

    def test_cancel_own_booking(self):
        s = _session(MILA)
        r = s.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": _future_date(40),
            "time": "18:30", "party_size": 2,
        }, timeout=10)
        bid = r.json()["id"]
        r2 = s.post(f"{API}/bookings/{bid}/cancel", timeout=10)
        assert r2.status_code == 200
        # cannot cancel again
        r3 = s.post(f"{API}/bookings/{bid}/cancel", timeout=10)
        assert r3.status_code == 400

    def test_cannot_cancel_other_members_booking(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": _future_date(41),
            "time": "19:00", "party_size": 2,
        }, timeout=10)
        bid = r.json()["id"]

        sa = _session(ALEX)
        r2 = sa.post(f"{API}/bookings/{bid}/cancel", timeout=10)
        assert r2.status_code == 403

    def test_staff_list_and_patch_booking(self):
        # member creates
        sm = _session(MILA)
        r = sm.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": _future_date(50),
            "time": "21:00", "party_size": 3, "note": "TEST_confirm me",
        }, timeout=10)
        bid = r.json()["id"]

        # verre staff sees it
        ss = _session(STAFF_VERRE)
        rlist = ss.get(f"{API}/staff/venues/venue-verre/bookings", timeout=10)
        assert rlist.status_code == 200
        assert any(x["id"] == bid for x in rlist.json())

        # ikigai staff blocked from verre
        si = _session(STAFF_IKIGAI)
        rx = si.get(f"{API}/staff/venues/venue-verre/bookings", timeout=10)
        assert rx.status_code == 403

        # confirm
        rp = ss.patch(f"{API}/staff/bookings/{bid}", json={
            "status": "confirmed", "staff_reply": "TEST_See you at 9."
        }, timeout=10)
        assert rp.status_code == 200
        # member sees updated status/reply
        mine = sm.get(f"{API}/members/me/bookings", timeout=10).json()
        matched = next(x for x in mine if x["id"] == bid)
        assert matched["status"] == "confirmed"
        assert matched["staff_reply"] == "TEST_See you at 9."

    def test_staff_cannot_patch_other_venue_booking(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/bookings", json={
            "venue_id": "venue-verre", "date": _future_date(51),
            "time": "22:00", "party_size": 2,
        }, timeout=10)
        bid = r.json()["id"]
        si = _session(STAFF_IKIGAI)
        rp = si.patch(f"{API}/staff/bookings/{bid}", json={"status": "declined"}, timeout=10)
        assert rp.status_code == 403
