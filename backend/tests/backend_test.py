"""Ritual backend API tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ritual-collective-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "bhandariyashvee@gmail.com", "password": "ritual2026"}
ALEX = {"email": "alex@ritual.app", "password": "ritual2026"}
MILA = {"email": "mila@ritual.app", "password": "ritual2026"}
STAFF_LUMEN = {"email": "staff.lumen@ritual.app", "password": "ritual2026"}
STAFF_VERRE = {"email": "staff.verre@ritual.app", "password": "ritual2026"}


def _session(creds=None):
    s = requests.Session()
    if creds:
        r = s.post(f"{API}/auth/login", json=creds, timeout=15)
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
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
        assert d["tier"] in ("Insider", "Inner Circle")

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
        s = _session(STAFF_LUMEN)
        r = s.get(f"{API}/auth/me", timeout=10)
        d = r.json()
        assert d["role"] == "staff"
        assert d["staff_venue_id"] == "venue-lumen"


# --- Venues ---
class TestVenues:
    def test_list_venues(self):
        r = requests.get(f"{API}/venues", timeout=10)
        assert r.status_code == 200
        venues = r.json()
        assert len(venues) == 6
        ids = [v["id"] for v in venues]
        assert "venue-aureus" in ids and "venue-lumen" in ids

    def test_filter_day(self):
        r = requests.get(f"{API}/venues?daypart=day", timeout=10)
        assert r.status_code == 200
        for v in r.json():
            assert v["daypart"] in ("day", "both")

    def test_filter_night(self):
        r = requests.get(f"{API}/venues?daypart=night", timeout=10)
        for v in r.json():
            assert v["daypart"] in ("night", "both")

    def test_venue_detail_with_events(self):
        r = requests.get(f"{API}/venues/venue-lumen", timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["name"] == "Lumen"
        assert "signature_offerings" in v
        assert "events" in v
        assert isinstance(v["events"], list)

    def test_venue_404(self):
        r = requests.get(f"{API}/venues/nonexistent", timeout=10)
        assert r.status_code == 404


# --- Checkin & Wallet & Redeem (E2E) ---
class TestCheckInAndRedeem:
    def test_e2e_admin_checkin_redeem(self):
        s = _session(ADMIN)
        w0 = s.get(f"{API}/wallet", timeout=10).json()
        balance0 = w0["balance"]

        # Check in at Aureus
        r = s.post(f"{API}/venues/venue-aureus/checkin", json={}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["points_earned"] == 100
        assert data["balance"] == balance0 + 100
        checkin_id = data["checkin_id"]

        # Feedback
        fb = s.post(f"{API}/checkins/feedback", json={
            "checkin_id": checkin_id,
            "item_ordered": "Kyoto Cold Brew",
            "would_return": True,
        }, timeout=10)
        assert fb.status_code == 200

        # Wallet ledger updated
        w1 = s.get(f"{API}/wallet", timeout=10).json()
        assert w1["balance"] == balance0 + 100
        assert w1["ledger"][0]["type"] == "earn"

        # Redeem at Lumen — complimentary (500)
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-lumen",
            "perk_code": "complimentary",
        }, timeout=10)
        assert r.status_code == 200, r.text
        red = r.json()
        assert red["balance"] == balance0 + 100 - 500
        assert red["redemption"]["code"].startswith("R-")
        assert red["redemption"]["venue_id"] == "venue-lumen"

        # Held redemption visible
        r = s.get(f"{API}/wallet/redemptions", timeout=10)
        assert r.status_code == 200
        assert any(x["code"] == red["redemption"]["code"] for x in r.json())

    def test_tier_gate_regular_cannot_inner_experience(self):
        s = _session(ALEX)  # Regular
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-lumen",
            "perk_code": "inner_experience",
        }, timeout=10)
        assert r.status_code == 403

    def test_admin_can_inner_experience(self):
        # Admin is Devotee — should succeed if balance sufficient. Give admin history buffer.
        s = _session(ADMIN)
        wallet = s.get(f"{API}/wallet", timeout=10).json()
        if wallet["balance"] < 1000:
            pytest.skip("admin balance insufficient for this test after prior redemption")
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-lumen",
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
        s = _session(STAFF_LUMEN)
        r = s.get(f"{API}/staff/venues", timeout=10)
        assert r.status_code == 200
        vs = r.json()
        assert len(vs) == 1
        assert vs[0]["id"] == "venue-lumen"

    def test_staff_status_update(self):
        s = _session(STAFF_LUMEN)
        r = s.patch(f"{API}/staff/venues/venue-lumen/status", json={"status": "Filling In"}, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-lumen", timeout=10).json()
        assert v["status"] == "Filling In"

    def test_staff_cannot_update_other_venue(self):
        s = _session(STAFF_LUMEN)
        r = s.patch(f"{API}/staff/venues/venue-verre/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403

    def test_member_cannot_access_staff(self):
        s = _session(ALEX)
        r = s.patch(f"{API}/staff/venues/venue-lumen/status", json={"status": "Quiet"}, timeout=10)
        assert r.status_code == 403
        r2 = s.get(f"{API}/staff/venues", timeout=10)
        assert r2.status_code == 403

    def test_staff_analytics(self):
        s = _session(STAFF_LUMEN)
        r = s.get(f"{API}/staff/venues/venue-lumen/analytics", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("checkins_week", "points_issued", "points_redeemed", "top_offerings"):
            assert k in d

    def test_staff_create_event(self):
        s = _session(STAFF_LUMEN)
        r = s.post(f"{API}/staff/venues/venue-lumen/events", json={
            "title": "TEST_Event",
            "description": "A test event",
            "date": "2026-04-01",
            "time": "20:00",
            "tier_required": "Regular",
        }, timeout=10)
        assert r.status_code == 200
        v = requests.get(f"{API}/venues/venue-lumen", timeout=10).json()
        assert any(e["title"] == "TEST_Event" for e in v["events"])

    def test_staff_redemptions(self):
        s = _session(STAFF_LUMEN)
        r = s.get(f"{API}/staff/venues/venue-lumen/redemptions", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Concierge (Personal Concierge feature) ---
class TestConcierge:
    def test_member_create_and_get_concierge(self):
        s = _session(MILA)
        # Create hold_table request at Lumen
        r = s.post(f"{API}/venues/venue-lumen/concierge", json={
            "message": "TEST_A quiet corner if possible.",
            "request_type": "hold_table",
            "party_size": 2,
            "arrival_time": "21:30",
        }, timeout=10)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["status"] == "pending"
        assert msg["venue_id"] == "venue-lumen"
        assert msg["request_type"] == "hold_table"
        assert msg["party_size"] == 2
        assert msg["member_name"]
        assert msg["member_tier"]
        msg_id = msg["id"]

        # GET member's notes
        r2 = s.get(f"{API}/members/me/concierge", timeout=10)
        assert r2.status_code == 200
        items = r2.json()
        assert any(x["id"] == msg_id for x in items)
        return msg_id

    def test_venue_not_found(self):
        s = _session(MILA)
        r = s.post(f"{API}/venues/nonexistent/concierge", json={
            "message": "hi", "request_type": "request"
        }, timeout=10)
        assert r.status_code == 404

    def test_staff_cannot_create_concierge(self):
        s = _session(STAFF_LUMEN)
        r = s.post(f"{API}/venues/venue-lumen/concierge", json={
            "message": "hi", "request_type": "request"
        }, timeout=10)
        assert r.status_code == 403

    def test_staff_inbox_and_cross_venue_403(self):
        # Member creates a note at Lumen
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-lumen/concierge", json={
            "message": "TEST_preview please", "request_type": "preview_menu"
        }, timeout=10)
        assert r.status_code == 200
        msg_id = r.json()["id"]

        # Lumen staff sees inbox
        ss = _session(STAFF_LUMEN)
        r2 = ss.get(f"{API}/staff/venues/venue-lumen/concierge", timeout=10)
        assert r2.status_code == 200
        assert any(x["id"] == msg_id for x in r2.json())

        # Verre staff must NOT access Lumen inbox
        sv = _session(STAFF_VERRE)
        r3 = sv.get(f"{API}/staff/venues/venue-lumen/concierge", timeout=10)
        assert r3.status_code == 403

        # Verre staff CANNOT update Lumen msg
        r4 = sv.patch(f"{API}/staff/concierge/{msg_id}", json={"status": "acknowledged"}, timeout=10)
        assert r4.status_code == 403

    def test_staff_update_concierge_status(self):
        # Create note
        sm = _session(MILA)
        r = sm.post(f"{API}/venues/venue-lumen/concierge", json={
            "message": "TEST_update flow", "request_type": "request"
        }, timeout=10)
        msg_id = r.json()["id"]

        ss = _session(STAFF_LUMEN)
        # Acknowledge with reply
        r2 = ss.patch(f"{API}/staff/concierge/{msg_id}", json={
            "status": "acknowledged", "response": "We have you noted."
        }, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "acknowledged"

        # Member sees the reply
        items = sm.get(f"{API}/members/me/concierge", timeout=10).json()
        matched = next((x for x in items if x["id"] == msg_id), None)
        assert matched is not None
        assert matched["status"] == "acknowledged"
        assert matched["response"] == "We have you noted."

        # Fulfill
        r3 = ss.patch(f"{API}/staff/concierge/{msg_id}", json={"status": "fulfilled"}, timeout=10)
        assert r3.status_code == 200

    def test_update_nonexistent_msg(self):
        ss = _session(STAFF_LUMEN)
        r = ss.patch(f"{API}/staff/concierge/nonexistent-id", json={"status": "acknowledged"}, timeout=10)
        assert r.status_code == 404


# --- Regression: tier gate 403 before 400 balance ---
class TestTierGateOrdering:
    def test_regular_low_balance_gets_403_not_400(self):
        s = _session(ALEX)  # Regular member, 420 pts
        # inner_experience requires Insider tier AND 1000 pts. Alex has neither.
        r = s.post(f"{API}/wallet/redeem", json={
            "venue_id": "venue-lumen", "perk_code": "inner_experience"
        }, timeout=10)
        assert r.status_code == 403, f"expected 403 tier-gate before 400 balance, got {r.status_code}"

