# Ritual — Product Requirements Doc

## Original problem statement
Build a web app called "Ritual" — an ultra-premium, cross-venue loyalty and live-access platform spanning both daytime dining (restaurants, cafes) and nightlife (bars, clubs, lounges) in a single city / neighborhood. Feels like a members' app for people who move between a quiet lunch and a late night out — a private members' club crossed with an airline elite-status program.

## Core concept
Points ("Ritual Points") earned at any partner venue can be redeemed at ANY other partner venue in the network, day or night. Cross-venue redemption is the entire pitch — your loyalty follows you.

## User personas
- **Member (Guest / Regular / Insider / Inner Circle)** — moves between rooms across the day. Wants to be recognized, wants perks, wants a quiet elegant experience.
- **Venue Staff** — a single venue's front desk. Wants to adjust room energy, see redemptions, post events.
- **Admin (owner)** — cross-venue oversight, can manage any venue.

## Core requirements (static)
- **Palette** deep charcoal `#0F0F0F`, warm gold `#C2A36B`, off-white `#F4F4EE`
- **Typography** Cormorant Garamond (serif display) + Manrope (sans body)
- **No** bright reds/oranges, no star ratings, no cartoon iconography
- Mobile-first, generous whitespace, one primary action per screen
- Editorial copy: "A table awaits.", "Your Ritual continues at Lumen.", "Inner Circle Access"
- Points earned = 100 per check-in
- Tier ladder by lifetime_points: Guest (0), Regular (500), Insider (1500), Inner Circle (3000)
- Perks: Priority Seating (250, Guest+), Complimentary Signature (500, Regular+), Early Access Booking (750, Regular+), Inner Circle Experience (1000, Insider+)

## Implemented — Feb 2026
- [x] JWT httpOnly cookie auth (bcrypt, SameSite=None, 12h access / 30d refresh)
- [x] 5 demo users seeded (admin, Inner Circle, Regular, 2 staff) + 6 venues + 6 events
- [x] Discover grid with Day / Night / All filters + live status indicators (Quiet / Filling in / At Capacity)
- [x] Venue detail with editorial hero, ranked signature offerings, tier-gated events
- [x] Check-in flow: QR-style prompt → confirm arrival → +100 pts confirmation → "what did you have?" feedback → done
- [x] Feedback feeds signature offerings (aggregated by `would_return`)
- [x] Wallet: giant serif balance, tier badge, lifetime / visits / tier, ledger, held redemptions
- [x] Redeem flow: pick any venue → pick perk (tier-gated, disabled if unaffordable/locked) → confirm → reservation code
- [x] Profile: tier journey ladder, progress %, curated timeline of past visits, correspondence section
- [x] Staff dashboard: multi-venue selector for admin, status control (Quiet / Filling In / At Capacity), analytics (checkins week/total, points issued vs redeemed, top offerings), redemptions list, event posting with tier gate
- [x] Role-based routing (staff → /staff, member → /discover, unauthorized → /discover)
- [x] Bottom nav (Discover / Scan / Wallet / Profile) for members
- [x] Toaster (sonner) with dark editorial styling
- [x] End-to-end demo flow verified: check-in Aureus (day cafe) → redeem at Lumen (night lounge) with reservation code

### Feb 4 — Concierge + Live QR Scan
- [x] Personal Concierge — member can send a note to any venue (hold a table / preview the menu / general request) with optional party size + arrival time
- [x] Correspondence section on member Profile with real-time status (pending → acknowledged / fulfilled / regrets) + room's reply
- [x] Staff Dashboard "Correspondence" tab — inbox with pending badge count, quiet reply textarea, three actions (Acknowledge / Mark fulfilled / Send regrets)
- [x] Staff Dashboard "QR Code" tab — displays a scannable QR encoding the venue's check-in URL (for the host stand)
- [x] `/scan` page with live camera scanner (html5-qrcode) + graceful fallback venue selector for environments without camera
- [x] "Speak with the room" button on venue detail opens the concierge modal
- [x] Removed Staff link from member Layout header — staff have their own dedicated interface at `/staff`
- [x] Tier ladder finalised as Guest → Regular → Insider → Inner Circle

## Test coverage
- Backend pytest 20/20 (after tier-gate ordering fix)
- Frontend Playwright E2E: auth, discover, venue detail, check-in, wallet, redeem, staff, tier-gate, authz — all pass on mobile 390x844

## Prioritized backlog

### P1 — Deferred from first pass
- Real QR code scan (currently a styled button + venue selector)
- Push notifications for tier promotions / booking confirmations
- Waitlist / RSVP for events (currently events are display-only)

### P2 — Growth / delight
- Referral: invite a friend for a small point bonus (drives network effect)
- Neighborhood picker (multi-city or multi-neighborhood)
- "Companion pass" — bring a +1 who inherits your tier for the evening
- Editorial content: monthly "the Correspondence" note from each venue
- Concierge SMS / email hooks (Resend or Twilio)
