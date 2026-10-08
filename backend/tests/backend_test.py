"""Table backend API tests (post-pivot from Nocturne/Ritual to Table restaurants)."""
import os
from pathlib import Path
import requests
import pytest
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

_ENV = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
ADMIN = {
    "email": os.environ.get("ADMIN_EMAIL", _ENV.get("ADMIN_EMAIL")),
    "password": os.environ.get("ADMIN_PASSWORD", _ENV.get("ADMIN_PASSWORD")),
}
ALEX = {"email": "alex@ritual.app", "password": "ritual2026"}
MILA = {"email": "mila@ritual.app", "password": "ritual2026"}
# staff.lumen is mapped to venue-sonder-bar per seed; staff.verre → venue-bombay-canteen
STAFF_SONDER = {"email": "staff.lumen@ritual.app", "password": "ritual2026"}
STAFF_CANTEEN = {"email": "staff.verre@ritual.app", "password": "ritual2026"}

SEED_VENUE_IDS = {
    "venue-bombay-canteen", "venue-soda-bottle-co", "venue-masque", "venue-sonder-bar",
}
LEGACY_VENUE_IDS = {
    "venue-lumen", "venue-noctis", "venue-aureole", "venue-aureus",
    "venue-verre", "venue-osteria", "venue-ikigai", "venue-chambre",
}


def _session(creds=None):
    s = requests.Session()
    if creds:
        r = s.post(f"{API}/auth/login", json=creds, timeout=15)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
        if BASE_URL.startswith("http://"):
            # Auth cookies are Secure; let requests resend them to a local http server.
            for c in s.cookies:
                c.secure = False
    return s


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
        s = _session(STAFF_CANTEEN)
        r = s.get(f"{API}/auth/me", timeout=10)
        d = r.json()
        assert d["role"] == "staff"
        assert d["staff_venue_id"] == "venue-bombay-canteen"


# --- Venues (post-pivot: restaurants) ---
class TestVenues:
    def test_list_venues_includes_seed_partners(self):
        r = requests.get(f"{API}/venues", timeout=10)
        assert r.status_code == 200
        ids = {v["id"] for v in r.json()}
        # Admin-added partners may also exist; the seeds must all be there.
        assert SEED_VENUE_IDS <= ids, f"missing seeds: {SEED_VENUE_IDS - ids}"
        assert ids.isdisjoint(LEGACY_VENUE_IDS)

    def test_venues_have_partner_fields(self):
        venues = requests.get(f"{API}/venues", timeout=10).json()
        for v in venues:
            assert v["type"] == "Restaurant"
            assert v.get("cuisine")
            assert v.get("slug")
            assert isinstance(v.get("price_level"), int) and 1 <= v["price_level"] <= 4
            assert v.get("availability") in ("seat_now", "waitlist", "full", "quiet")
            assert isinstance(v.get("points_per_visit"), int)

    def test_venue_detail_bombay_canteen(self):
        r = requests.get(f"{API}/venues/venue-bombay-canteen", timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["name"] == "Bombay Canteen"
        assert v["cuisine"] == "Modern Indian"
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

        # Check in at Bombay Canteen
        r = s.post(f"{API}/venues/venue-bombay-canteen/checkin", json={}, timeout=10)
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

        # Redeem complimentary (500) at Bombay Canteen
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-bombay-canteen",
            "perk_code": "complimentary",
        }, timeout=10)
        assert r.status_code == 200, r.text
        red = r.json()
        assert red["balance"] == balance0 + 100 - 500
        assert red["redemption"]["code"].startswith("R-")
        assert red["redemption"]["venue_id"] == "venue-bombay-canteen"

        r = s.get(f"{API}/wallet/redemptions", timeout=10)
        assert r.status_code == 200
        assert any(x["code"] == red["redemption"]["code"] for x in r.json())

    def test_tier_gate_regular_cannot_inner_experience(self):
        s = _session(ALEX)
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-bombay-canteen",
            "perk_code": "inner_experience",
        }, timeout=10)
        assert r.status_code == 403

    def test_mila_inner_circle_can_redeem_inner_experience(self):
        s = _session(MILA)
        wallet = s.get(f"{API}/wallet", timeout=10).json()
        if wallet["balance"] < 1000:
            pytest.skip("mila balance insufficient")
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-bombay-canteen",
            "perk_code": "inner_experience",
        }, timeout=10)
        assert r.status_code == 200

    def test_perks_endpoint(self):
        r = requests.get(f"{API}/perks", timeout=10)
        assert r.status_code == 200
        codes = [p["code"] for p in r.json()]
        assert set(codes) == {"priority", "complimentary", "early_access", "inner_experience"}


# --- Staff ---
class TestStaff:
    def test_staff_venues_scoped(self):
        s = _session(STAFF_CANTEEN)
        r = s.get(f"{API}/staff/venues", timeout=10)
        assert r.status_code == 200
        vs = r.json()
        assert len(vs) == 1
        assert vs[0]["id"] == "venue-bombay-canteen"

    def test_staff_status_update(self):
        s = _session(STAFF_CANTEEN)
        r = s.patch(f"{API}/staff/venues/venue-bombay-canteen/status", json={"status": "Filling In"}, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-bombay-canteen", timeout=10).json()
        assert v["status"] == "Filling In"
        # Partner state persists across restarts now, so put it back.
        s.patch(f"{API}/staff/venues/venue-bombay-canteen/status", json={"status": "Quiet"}, timeout=10)

    def test_staff_cannot_update_other_venue(self):
        s = _session(STAFF_CANTEEN)
        r = s.patch(f"{API}/staff/venues/venue-sonder-bar/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403

    def test_member_cannot_access_staff(self):
        s = _session(ALEX)
        r = s.patch(f"{API}/staff/venues/venue-bombay-canteen/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403
        r2 = s.get(f"{API}/staff/venues", timeout=10)
        assert r2.status_code == 403

    def test_staff_analytics(self):
        s = _session(STAFF_CANTEEN)
        r = s.get(f"{API}/staff/venues/venue-bombay-canteen/analytics", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("checkins_week", "points_issued", "points_redeemed", "top_offerings"):
            assert k in d

    def test_staff_create_event(self):
        s = _session(STAFF_CANTEEN)
        r = s.post(f"{API}/staff/venues/venue-bombay-canteen/events", json={
            "title": "TEST_Event",
            "description": "A test event",
            "date": "2026-04-01",
            "time": "20:00",
            "tier_required": "Regular",
        }, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-bombay-canteen", timeout=10).json()
        assert any(e["title"] == "TEST_Event" for e in v["events"])

    def test_staff_redemptions(self):
        s = _session(STAFF_CANTEEN)
        r = s.get(f"{API}/staff/venues/venue-bombay-canteen/redemptions", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Concierge ---
class TestConcierge:
    def test_member_create_and_get_concierge(self):
        s = _session(MILA)
        r = s.post(f"{API}/venues/venue-bombay-canteen/concierge", json={
            "message": "TEST_A quiet corner if possible.",
            "request_type": "hold_table",
            "party_size": 2,
            "arrival_time": "21:30",
        }, timeout=10)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["status"] == "pending"
        assert msg["venue_id"] == "venue-bombay-canteen"
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
        s = _session(STAFF_CANTEEN)
        r = s.post(f"{API}/venues/venue-bombay-canteen/concierge", json={
            "message": "hi", "request_type": "request"
        }, timeout=10)
        assert r.status_code == 403

    def test_staff_inbox_and_cross_venue_403(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-bombay-canteen/concierge", json={
            "message": "TEST_preview please", "request_type": "preview_menu"
        }, timeout=10)
        assert r.status_code == 200
        msg_id = r.json()["id"]

        # Bombay Canteen staff sees it
        ss = _session(STAFF_CANTEEN)
        r2 = ss.get(f"{API}/staff/venues/venue-bombay-canteen/concierge", timeout=10)
        assert r2.status_code == 200
        assert any(x["id"] == msg_id for x in r2.json())

        # Sonder Bar staff must NOT access Bombay Canteen inbox
        si = _session(STAFF_SONDER)
        r3 = si.get(f"{API}/staff/venues/venue-bombay-canteen/concierge", timeout=10)
        assert r3.status_code == 403

        r4 = si.patch(f"{API}/staff/concierge/{msg_id}", json={"status": "acknowledged"}, timeout=10)
        assert r4.status_code == 403

    def test_staff_update_concierge_status(self):
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-bombay-canteen/concierge", json={
            "message": "TEST_update flow", "request_type": "request"
        }, timeout=10)
        msg_id = r.json()["id"]

        ss = _session(STAFF_CANTEEN)
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
        ss = _session(STAFF_CANTEEN)
        r = ss.patch(f"{API}/staff/concierge/nonexistent-id", json={"status": "acknowledged"}, timeout=10)
        assert r.status_code == 404


# --- Regression: tier gate 403 before 400 balance ---
class TestTierGateOrdering:
    def test_regular_low_balance_gets_403_not_400(self):
        s = _session(ALEX)
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-bombay-canteen", "perk_code": "inner_experience"
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
        r = s.get(f"{API}/venues/venue-bombay-canteen/availability", params={"date": date}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["venue_id"] == "venue-bombay-canteen"
        assert data["date"] == date
        slots = data["slots"]
        assert isinstance(slots, list) and len(slots) > 0
        # Bombay Canteen hours "18:00 – 01:00" -> last slot 30 min before close => 00:30
        # Count depends on parse; must include half-hour cadence
        times = [s_["time"] for s_ in slots]
        assert times[0] == "18:00"
        assert all(_re.match(r"^\d{2}:\d{2}$", t) for t in times)
        for s_ in slots:
            assert "remaining" in s_ and "available" in s_
            assert isinstance(s_["remaining"], int)
            assert isinstance(s_["available"], bool)

    def test_availability_requires_auth(self):
        r = requests.get(f"{API}/venues/venue-bombay-canteen/availability", params={"date": _future_date()}, timeout=10)
        assert r.status_code == 401

    def test_availability_bad_venue(self):
        s = _session(MILA)
        r = s.get(f"{API}/venues/nope/availability", params={"date": _future_date()}, timeout=10)
        assert r.status_code == 404

    def test_create_booking_returns_T_code(self):
        s = _session(MILA)
        date = _future_date(21)
        payload = {"venue_id": "venue-bombay-canteen", "date": date, "time": "19:30",
                   "party_size": 2, "note": "TEST_window seat"}
        r = s.post(f"{API}/bookings", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert _re.match(r"^T-[A-Z2-9]{6}$", b["code"]), f"bad code {b['code']}"
        # No lookalikes (I, L, O, 0, 1)
        assert not any(c in b["code"][2:] for c in "ILO01")
        assert b["status"] == "pending"
        assert b["venue_name"] == "Bombay Canteen"
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
            "venue_id": "venue-bombay-canteen", "date": _future_date(22),
            "time": "10:00", "party_size": 2,
        }, timeout=10)
        assert r.status_code == 400

    def test_slot_capacity_6_then_409(self):
        # Fill a slot with 6 pending bookings across mila (6 dupes) — API allows same user multiple
        s = _session(MILA)
        date = _future_date(30)
        time = "20:00"
        codes, ids = [], []
        for i in range(6):
            r = s.post(f"{API}/bookings", json={
                "venue_id": "venue-bombay-canteen", "date": date, "time": time, "party_size": 2,
            }, timeout=10)
            assert r.status_code == 200, f"slot fill {i} failed: {r.text}"
            codes.append(r.json()["code"])
            ids.append(r.json()["id"])
        # 7th must 409
        r7 = s.post(f"{API}/bookings", json={
            "venue_id": "venue-bombay-canteen", "date": date, "time": time, "party_size": 2,
        }, timeout=10)
        assert r7.status_code == 409
        assert "full" in r7.json()["detail"].lower()

        # availability shows available=false, remaining=0 for that time
        av = s.get(f"{API}/venues/venue-bombay-canteen/availability", params={"date": date}, timeout=10).json()
        slot = next(x for x in av["slots"] if x["time"] == time)
        assert slot["available"] is False
        assert slot["remaining"] == 0

        # Release the slot so the suite can be re-run against the same database.
        for bid in ids:
            s.post(f"{API}/bookings/{bid}/cancel", timeout=10)

    def test_cancel_own_booking(self):
        s = _session(MILA)
        r = s.post(f"{API}/bookings", json={
            "venue_id": "venue-bombay-canteen", "date": _future_date(40),
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
            "venue_id": "venue-bombay-canteen", "date": _future_date(41),
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
            "venue_id": "venue-bombay-canteen", "date": _future_date(50),
            "time": "21:00", "party_size": 3, "note": "TEST_confirm me",
        }, timeout=10)
        bid = r.json()["id"]

        # Bombay Canteen staff sees it
        ss = _session(STAFF_CANTEEN)
        rlist = ss.get(f"{API}/staff/venues/venue-bombay-canteen/bookings", timeout=10)
        assert rlist.status_code == 200
        assert any(x["id"] == bid for x in rlist.json())

        # Sonder Bar staff blocked from Bombay Canteen
        si = _session(STAFF_SONDER)
        rx = si.get(f"{API}/staff/venues/venue-bombay-canteen/bookings", timeout=10)
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
            "venue_id": "venue-bombay-canteen", "date": _future_date(51),
            "time": "22:00", "party_size": 2,
        }, timeout=10)
        bid = r.json()["id"]
        si = _session(STAFF_SONDER)
        rp = si.patch(f"{API}/staff/bookings/{bid}", json={"status": "declined"}, timeout=10)
        assert rp.status_code == 403


# --- Partners (admin-managed restaurant network) ---
import base64 as _b64
import uuid as _uuid

# 1x1 transparent PNG
_PNG_DATA_URL = "data:image/png;base64," + _b64.b64encode(
    _b64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )
).decode()


def _partner_payload(name, **overrides):
    payload = {
        "name": name,
        "area": "Bandra West",
        "cuisine": "Coastal",
        "address": "Hill Road",
        "distance_km": 0.8,
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0",
        "availability": "waitlist",
        "waitlist_minutes": 25,
        "walk_in": True,
        "double_points_tonight": True,
        "chefs_pick": False,
        "points_per_visit": 9,
        "price_band": 1,
        "most_reordered": ["Prawn koliwada", "Sol kadhi"],
        "events": [{
            "title": "TEST_Fish fry Sunday",
            "date": _future_date(9),
            "time": "13:00",
            "seats": 16,
            "tier_required": "Regular",
        }],
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def created_partner():
    s = _session(ADMIN)
    name = f"TEST Partner {_uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/partners", json=_partner_payload(name), timeout=10)
    assert r.status_code == 201, r.text
    partner = r.json()
    yield partner
    s.delete(f"{API}/partners/{partner['id']}", timeout=10)


class TestPartners:
    def test_list_is_public_and_has_seed_shape(self):
        r = requests.get(f"{API}/partners", timeout=10)
        assert r.status_code == 200
        by_slug = {p["slug"]: p for p in r.json()}
        bc = by_slug["bombay-canteen"]
        assert bc["area"] == "Kala Ghoda"
        assert bc["points_per_visit"] == 12
        assert bc["distance_km"] == 2.1
        assert bc["double_points_tonight"] and bc["chefs_pick"]
        assert bc["most_reordered"] == ["Kejriwal toast", "Pork vindaloo"]
        masque_event = by_slug["masque"]["events"][0]
        assert masque_event["seats"] == 12 and masque_event["tier_required"] == "Insider"
        assert "rsvps" not in masque_event

    def test_get_by_slug_and_404(self):
        assert requests.get(f"{API}/partners/sonder-bar", timeout=10).json()["name"] == "Sonder Bar"
        assert requests.get(f"{API}/partners/nope", timeout=10).status_code == 404

    @pytest.mark.parametrize("creds", [ALEX, STAFF_CANTEEN])
    def test_non_admin_writes_forbidden(self, creds, created_partner):
        s = _session(creds)
        pid = created_partner["id"]
        assert s.post(f"{API}/partners", json=_partner_payload("TEST nope"), timeout=10).status_code == 403
        assert s.put(f"{API}/partners/{pid}", json=_partner_payload("TEST nope"), timeout=10).status_code == 403
        assert s.delete(f"{API}/partners/{pid}", timeout=10).status_code == 403
        assert s.post(f"{API}/partners/photo", json={"data_url": _PNG_DATA_URL}, timeout=10).status_code == 403
        assert requests.get(f"{API}/partners/{pid}", timeout=10).status_code == 200

    def test_unauthenticated_writes_401(self):
        assert requests.post(f"{API}/partners", json=_partner_payload("TEST anon"), timeout=10).status_code == 401
        assert requests.delete(f"{API}/partners/venue-masque", timeout=10).status_code == 401

    def test_admin_create_shows_everywhere(self, created_partner):
        p = created_partner
        assert p["slug"].startswith("test-partner-")
        assert p["status"] == "Filling In"  # legacy status derived for staff tools
        assert p["events"][0]["seats"] == 16
        listed = requests.get(f"{API}/partners", timeout=10).json()
        assert any(x["id"] == p["id"] for x in listed)
        # Legacy venue endpoints (bookings, check-in) see it too
        assert requests.get(f"{API}/venues/{p['id']}", timeout=10).status_code == 200

    def test_duplicate_name_and_slug_rejected(self, created_partner):
        s = _session(ADMIN)
        r = s.post(f"{API}/partners", json=_partner_payload(created_partner["name"].upper()), timeout=10)
        assert r.status_code == 409
        r2 = s.post(f"{API}/partners", json=_partner_payload("Bombay Canteen!"), timeout=10)
        assert r2.status_code == 409

    def test_validation(self):
        s = _session(ADMIN)
        for bad in (
            {"name": "  "},
            {"image_url": "javascript:alert(1)"},
            {"points_per_visit": 0},
            {"area": ""},
        ):
            r = s.post(f"{API}/partners", json={**_partner_payload("TEST invalid"), **bad}, timeout=10)
            assert r.status_code == 422, (bad, r.text)

    def test_update_renames_and_syncs_events(self, created_partner):
        s = _session(ADMIN)
        p = created_partner
        new_name = p["name"] + " Renamed"
        keep = {**p["events"][0]}
        payload = _partner_payload(new_name, availability="full", events=[
            {k: keep[k] for k in ("id", "title", "date", "time", "seats", "tier_required")},
            {"title": "TEST_Second", "date": _future_date(12), "time": "20:00", "seats": 8, "tier_required": None},
        ])
        r = s.put(f"{API}/partners/{p['id']}", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["name"] == new_name and u["slug"].endswith("-renamed")
        assert u["availability"] == "full" and u["waitlist_minutes"] is None
        assert [e["title"] for e in u["events"]] == ["TEST_Fish fry Sunday", "TEST_Second"]
        assert u["events"][0]["id"] == keep["id"]
        # Drop all events
        r2 = s.put(f"{API}/partners/{p['id']}", json=_partner_payload(new_name, events=[]), timeout=10)
        assert r2.json()["events"] == []

    def test_delete(self):
        s = _session(ADMIN)
        r = s.post(f"{API}/partners", json=_partner_payload(f"TEST Gone {_uuid.uuid4().hex[:6]}"), timeout=10)
        pid = r.json()["id"]
        assert s.delete(f"{API}/partners/{pid}", timeout=10).status_code == 200
        assert requests.get(f"{API}/partners/{pid}", timeout=10).status_code == 404
        assert s.delete(f"{API}/partners/{pid}", timeout=10).status_code == 404

    def test_photo_upload_served(self):
        s = _session(ADMIN)
        r = s.post(f"{API}/partners/photo", json={"data_url": _PNG_DATA_URL}, timeout=10)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/uploads/") and url.endswith(".png")
        img = requests.get(f"{BASE_URL}{url}", timeout=10)
        assert img.status_code == 200 and img.content.startswith(b"\x89PNG")
        bad = s.post(f"{API}/partners/photo", json={"data_url": "data:image/png;base64," + _b64.b64encode(b"nope").decode()}, timeout=10)
        assert bad.status_code == 400

    def test_rsvp_toggle_and_tier_gate(self):
        partners = {p["slug"]: p for p in requests.get(f"{API}/partners", timeout=10).json()}
        vinyl = partners["sonder-bar"]["events"][0]  # Regular+
        counter = partners["masque"]["events"][0]  # Insider+
        s = _session(ALEX)  # Regular
        r = s.post(f"{API}/events/{vinyl['id']}/rsvp", timeout=10)
        assert r.status_code == 200 and r.json()["rsvped"] is True
        r = s.post(f"{API}/events/{vinyl['id']}/rsvp", timeout=10)
        assert r.json()["rsvped"] is False
        assert s.post(f"{API}/events/{counter['id']}/rsvp", timeout=10).status_code == 403

    def test_staff_status_syncs_availability(self):
        s = _session(STAFF_SONDER)
        assert s.patch(f"{API}/staff/venues/venue-sonder-bar/status", json={"status": "At Capacity"}, timeout=10).status_code == 200
        assert requests.get(f"{API}/partners/sonder-bar", timeout=10).json()["availability"] == "full"
        s.patch(f"{API}/staff/venues/venue-sonder-bar/status", json={"status": "Quiet"}, timeout=10)
        assert requests.get(f"{API}/partners/sonder-bar", timeout=10).json()["availability"] == "seat_now"
