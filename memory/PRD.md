# Table — Product Requirements Doc

## Original problem statement
Originally built as "Ritual" — an ultra-premium cross-venue loyalty and live-access platform. Pivoted to "Nocturne" (nightlife). Then pivoted again to **Table**, a **restaurant-only** members' collective with a fun, engaging, District-inspired UI. Points earned at any partner restaurant can be redeemed at ANY other partner restaurant in the network. Cross-venue redemption is the entire pitch — your table follows you.

## User personas
- **Member (Guest / Regular / Insider / Inner Circle)** — moves between the city's best restaurants. Wants to be recognized, wants perks, wants a warm engaging experience.
- **Venue Staff** — a single restaurant's front desk. Wants to adjust room energy, see redemptions, post events, respond to correspondence, confirm/decline bookings.
- **Admin (owner)** — cross-venue oversight, can manage any restaurant.

## Core requirements (static)
- **Palette (Burgundy — Feb 2026)** deep burgundy `#1A0912`, surface `#2E1220`, border `#4E1E32`, warm cream text `#F4E8DA`, muted rose-brown `#B39586`, warm gold accent `#C2A36B`
- **Typography** Cormorant Garamond (serif display) + Manrope (sans body)
- **UI aesthetic** — engaging, District-inspired: vibe pills (Chef's Pick, Date Night, Buzzing, Solo-Friendly…), chef attribution, price-level `$` – `$$$$`, tagline, featured Chef's Pick block, animated counters, sparkles on redemption, rotating hero quotes, "Surprise me" button
- Mobile-first, generous whitespace, one primary action per screen
- Points earned = 100 per check-in
- Tier ladder by lifetime_points: Guest (0), Regular (500), Insider (1500), Inner Circle (3000)
- Perks: Priority Seating (250, Guest+), Complimentary Signature (500, Regular+), Early Access Booking (750, Regular+), Chef's Counter Experience (1000, Insider+)

## Implemented — Feb 2026
- [x] JWT httpOnly cookie auth (bcrypt, SameSite=None, 12h access / 30d refresh)
- [x] Demo users seeded (admin, Inner Circle, Regular, 2 staff) + 6 restaurants + events
- [x] Discover grid with vibe filters (All / Chef's Picks / Date Night / Buzzing / Solo / Groups / Just Opened) + live status indicators (Quiet / Filling In / At Capacity)
- [x] Featured Chef's Pick block on Discover
- [x] Venue detail with editorial hero, ranked signature offerings, tier-gated events
- [x] Check-in flow: QR-style prompt → confirm arrival → +100 pts confirmation → feedback → done
- [x] Wallet: giant serif balance, tier badge, lifetime / visits / tier, ledger, held redemptions
- [x] Redeem flow: pick a restaurant where you hold points (points are per-restaurant, derived from the ledger) → pick perk (tier-gated) → confirm → reservation code
- [x] Profile: tier journey ladder, progress %, curated timeline of past visits, correspondence, **reservations**
- [x] Staff dashboard: multi-venue selector for admin, status control, analytics, redemptions, events, correspondence inbox, **bookings inbox**, QR display
- [x] Role-based routing (staff → /staff, member → /discover)
- [x] Bottom nav (Discover / Scan / Wallet / Profile) for members
- [x] Personal Concierge — send a note to any restaurant with optional party size + arrival time
- [x] `/scan` page with live camera scanner (html5-qrcode) + graceful fallback venue selector

### Feb 2026 — Table restaurant pivot
- [x] Rebranded from "Nocturne" (nightlife) to **"Table"** (restaurants)
- [x] SEED_VENUES rewritten: 6 restaurants (Verre / Osteria Verde / Ikigai / Salle Privée / La Petite / Chambre) with cuisine, price_level, chef, vibes, tagline
- [x] Legacy Nocturne venues auto-purged on backend startup via `delete_many({"id": {"$nin": seed_ids}})`
- [x] `VenueCard` redesigned with vibe pill, chef, `$$$` price, cuisine + neighborhood overline
- [x] `Discover` — vibe-based filter tabs, featured Chef's Pick hero, restaurant time greetings
- [x] `Landing` — "Your table follows you." editorial hero + rotating restaurant quotes

### Feb 2026 — Real Bookings API
- [x] `GET /api/venues/{id}/availability?date=YYYY-MM-DD` — parses `hours` into 30-min slots (handles crossing-midnight ranges), returns remaining seats-per-slot (cap 6)
- [x] `POST /api/bookings` — creates a pending reservation with a `T-XXXXXX` alphanumeric code (skips look-alike chars). Rejects invalid times and full slots (409).
- [x] `GET /api/members/me/bookings` + `POST /api/bookings/{id}/cancel` — member's own list, cancel own pending/confirmed
- [x] `GET /api/staff/venues/{id}/bookings` + `PATCH /api/staff/bookings/{id}` — staff-scoped inbox with confirm / decline / seat + optional reply
- [x] `BookingModal` — 7-day date carousel, live time-slot grid (disabled/line-through for full slots), party stepper 1–20, optional 280-char note, success screen with T-code
- [x] `VenueDetail` — primary "Reserve a table" CTA alongside secondary "Speak with the room" concierge, plus "Or check in on arrival" link
- [x] `Profile` — new "Your reservations" section with code, status, note, room's reply, cancel button
- [x] Staff Dashboard — new "Bookings" tab between Overview and Correspondence with pending badge

### Feb 2026 — Burgundy palette
- [x] Bulk hex swap across all frontend files: `#0A1424` → `#1A0912`, `#121D33` → `#2E1220`, `#253453` → `#4E1E32`, `#E8ECF5` → `#F4E8DA`, `#8996B0` → `#B39586`, `#5F6A83` → `#7A5C55`
- [x] index.css `:root` vars + shadcn HSL tokens re-tuned to burgundy (background 339 48% 7%, card 335 44% 13%, border 335 44% 21%)
- [x] `public/index.html` meta theme-color updated to `#1A0912`
- [x] Gold accent `#C2A36B` retained — pairs beautifully with burgundy

## Test coverage
- Backend pytest **38/38** (10 new booking tests: availability shape, T-code creation, invalid-time rejection, 6-per-slot capacity + 7th=409, cancel own/other, staff cross-venue 403)
- Frontend Playwright E2E: auth, discover, filter tabs, surprise-me, venue detail, concierge, wallet, redeem, /scan fallback, **booking creation & cancel**, **staff bookings confirm/decline/seat**, burgundy palette

## Prioritized backlog

### P1 — Nice to have
- Push notifications for tier promotions / booking confirmations
- Waitlist / RSVP for events (currently events are display-only)
- SMS/email booking confirmations (Resend or Twilio)
- Chef Spotlights: rotating chef bio card on Discover with signature dish

### P2 — Growth / delight
- Referral: invite a friend for a small point bonus
- Neighborhood picker (multi-city or multi-neighborhood)
- "Companion pass" — bring a +1 who inherits your tier for the evening
- Editorial content: monthly "the Correspondence" note from each restaurant
- Auto-suggest slots based on member's usual arrival time
