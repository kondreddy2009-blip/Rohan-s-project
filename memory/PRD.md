# Table — Product Requirements Doc

## Original problem statement
Originally built as "Ritual" — an ultra-premium cross-venue loyalty and live-access platform. Pivoted to "Nocturne" (nightlife). Now pivoted again to **Table**, a **restaurant-only** members' collective with a fun, engaging, District-inspired UI. Points earned at any partner restaurant can be redeemed at ANY other partner restaurant in the network. Cross-venue redemption is the entire pitch — your table follows you.

## User personas
- **Member (Guest / Regular / Insider / Inner Circle)** — moves between the city's best restaurants. Wants to be recognized, wants perks, wants a warm engaging experience.
- **Venue Staff** — a single restaurant's front desk. Wants to adjust room energy, see redemptions, post events, respond to correspondence.
- **Admin (owner)** — cross-venue oversight, can manage any restaurant.

## Core requirements (static)
- **Palette** deep midnight `#0A1424`, surface `#121D33`, warm gold `#C2A36B`, off-white `#E8ECF5`
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
- [x] Redeem flow: pick any restaurant → pick perk (tier-gated) → confirm → reservation code
- [x] Profile: tier journey ladder, progress %, curated timeline of past visits, correspondence
- [x] Staff dashboard: multi-venue selector for admin, status control, analytics, redemptions list, event posting, correspondence inbox, QR display
- [x] Role-based routing (staff → /staff, member → /discover)
- [x] Bottom nav (Discover / Scan / Wallet / Profile) for members
- [x] Personal Concierge — send a note to any restaurant with optional party size + arrival time
- [x] `/scan` page with live camera scanner (html5-qrcode) + graceful fallback venue selector

### Feb 2026 — Table restaurant pivot (District-style)
- [x] Rebranded from "Nocturne" (nightlife) to **"Table"** (restaurants)
- [x] SEED_VENUES rewritten: 6 restaurants (Verre / Osteria Verde / Ikigai / Salle Privée / La Petite / Chambre) with cuisine, price_level, chef, vibes, tagline
- [x] Legacy Nocturne venues (Lumen, Noctis, Auréole) auto-purged on backend startup via `delete_many({"id": {"$nin": seed_ids}})`
- [x] `VenueCard` redesigned with vibe pill, chef attribution, `$$$` price, cuisine + neighborhood overline
- [x] `Discover` — vibe-based filter tabs, featured Chef's Pick hero, restaurant-appropriate time greetings (Lunch service / Aperitivo / Dinner / Late service)
- [x] `Landing` — "Your table follows you." editorial hero + rotating restaurant quotes
- [x] Copy sweep: removed remaining "Ritual" references from Profile and CSS

## Test coverage
- Backend pytest 20/20
- Frontend Playwright E2E: auth, discover, venue detail, check-in, wallet, redeem, staff, concierge — all pass on mobile 390x844

## Prioritized backlog

### P1 — Nice to have
- Push notifications for tier promotions / booking confirmations
- Waitlist / RSVP for events (currently events are display-only)
- Concierge SMS / email hooks (Resend or Twilio) — turn "Speak with the room" into a real Bookings API with confirmed table times

### P2 — Growth / delight
- Referral: invite a friend for a small point bonus
- Neighborhood picker (multi-city or multi-neighborhood)
- "Companion pass" — bring a +1 who inherits your tier for the evening
- Editorial content: monthly "the Correspondence" note from each restaurant
- Chef spotlight cards on Discover (rotating chef bio + signature dish)
