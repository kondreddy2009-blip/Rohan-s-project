# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Table** — a restaurant-only members' loyalty and reservations platform (formerly "Ritual"/"Nocturne" before pivots — see `memory/PRD.md` for full product history). Members earn points at any partner restaurant and redeem perks at *any* other partner restaurant in the network; that cross-venue redemption is the core pitch. Three roles: **Member** (Guest/Regular/Insider/Inner Circle tiers), **Venue Staff** (manages one restaurant), **Admin** (cross-venue oversight).

`memory/PRD.md` is the living product requirements doc — check it for current feature status and design decisions before making product/UX changes.

## Architecture

- **backend/** — single-file FastAPI app (`server.py`, ~1800 lines) + Motor (async MongoDB driver). All routes are mounted under `/api` via one `APIRouter`. The file is organized into clearly marked sections (search for `# ---` banners): Setup → Constants (tiers/perks/points) → Razorpay helpers → Auth helpers → Pydantic models → Helpers → then route groups in order: Auth → Venues → Wallet → Member profile → Staff → Concierge (messaging) → Bookings → Venue loyalty → seed data (runs on startup).
- **frontend/** — Create React App (via CRACO) + React Router v7 + Tailwind + shadcn/ui (Radix primitives in `src/components/ui/`). `@` is aliased to `src/` (see `craco.config.js`).
- MongoDB is the only datastore. There are no migrations — `SEED_VENUES` in `server.py` seeds/reconciles venue data on every backend startup, and purges any venue not in the seed list (`delete_many({"id": {"$nin": seed_ids}})`) — don't rely on venue documents surviving a restart unless added to `SEED_VENUES`.

### Auth

JWT httpOnly cookies (`access_token` 12h, `refresh_token` 30d), bcrypt password hashing, `SameSite=None; Secure`. `get_current_user` reads the cookie first, falling back to an `Authorization: Bearer` header. `require_staff_or_admin` gates staff-only routes. On the frontend, `AuthProvider` (`src/lib/auth-context.jsx`) holds `user` as a tri-state: `null` = checking, `false` = signed out, object = signed in; `ProtectedRoute` (`src/components/ProtectedRoute.jsx`) redirects to `/login` when signed out and to `/discover` when a non-staff/admin user hits a `staff` route.

### Key domains in server.py

- **Loyalty** — two separate point systems: global member tier points (`POINTS_PER_CHECKIN`, `TIER_THRESHOLDS`, cross-venue `PERKS`) vs. per-venue loyalty (`/venues/{id}/loyalty`, staff-configurable `points_per_checkin`/`points_per_booking`/custom `rewards`, spent only at that one venue). Don't conflate the two.
- **Bookings** — `/venues/{id}/availability` parses each venue's `hours` string into 30-min slots (handles ranges crossing midnight) with a `SLOT_CAPACITY_PER_TIME` cap; `POST /bookings` issues a `T-XXXXXX` code (look-alike characters excluded) and returns 409 on a full slot. Optional Razorpay deposit flow (`razorpay_configured()` gates it — disabled until both `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set).
- **Concierge** — free-text messaging between a member and a venue (`CONCIERGE_TYPE_LABEL`), separate from bookings and check-ins.

### Frontend structure

- `src/pages/` — one file per route (matches `App.js` routes 1:1).
- `src/components/` — feature components (`BookingModal`, `QRScanner`/`QRDisplay`, `VenueCard`, etc.); `src/components/ui/` is the shadcn primitive layer — treat it as vendored, prefer composing over editing.
- `src/lib/api.js` — single axios instance (`withCredentials: true`, base URL from `REACT_APP_BACKEND_URL`) plus `formatApiError` for normalizing FastAPI's `detail` error shape (string, list of `{msg}`, or object).
- `src/constants/testIds/` — centralized `data-testid` constants used by both the app and `backend/tests`/E2E-style checks — keep these in sync when changing markup that tests key off of.

## Commands

### Backend (from `backend/`)

```bash
source .venv/bin/activate              # venv already present
pip install -r requirements.txt
python3 -m uvicorn server:app --reload --port 8001   # requires backend/.env (MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGINS; Razorpay vars optional)
```

Tests (`backend/tests/backend_test.py`) hit a **running** backend over HTTP rather than using a test client — start the server first, then set `REACT_APP_BACKEND_URL` to point at it:

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 pytest backend/tests/backend_test.py
REACT_APP_BACKEND_URL=http://localhost:8001 pytest backend/tests/backend_test.py -k test_login_admin_and_me   # single test
REACT_APP_BACKEND_URL=http://localhost:8001 pytest backend/tests/backend_test.py::TestAuth                    # single class
```

`backend/pytest.ini` pins `addopts = -n 2 --dist loadscope` (pytest-xdist, 2 workers, class/module-scoped) — don't override `-n`/`--dist`; tests assume sequential shared state within a class. Use `-n 0` to force serial instead of `-p no:xdist`.

### Frontend (from `frontend/`)

```bash
yarn install
yarn start   # dev server on :3000, requires frontend/.env (REACT_APP_BACKEND_URL, REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
yarn build
```

No frontend unit test suite is configured beyond the CRA/craco default (`craco test`, unused in practice — rely on `backend/tests` plus manual browser checks).
