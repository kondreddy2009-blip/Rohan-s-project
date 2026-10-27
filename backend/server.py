from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import hmac
import hashlib
import base64
import re
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi.middleware.cors import CORSMiddleware
from cryptography.fernet import Fernet, InvalidToken
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

# Sensitive payout fields (PAN, bank account number) are encrypted at rest.
# Set PAYOUT_ENCRYPTION_KEY (a Fernet key) in production; falling back to a key
# derived from JWT_SECRET means rotating JWT_SECRET would make stored values unreadable.
_payout_key = os.environ.get("PAYOUT_ENCRYPTION_KEY") or base64.urlsafe_b64encode(
    hashlib.sha256(JWT_SECRET.encode("utf-8")).digest()
).decode("utf-8")
payout_cipher = Fernet(_payout_key)

app = FastAPI(title="Table API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("table")


# ---------------------------------------------------------------------------
# Constants — tiers, perks, points
# ---------------------------------------------------------------------------
POINTS_PER_CHECKIN = 100

TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"]
TIER_THRESHOLDS = {
    "Guest": 0,
    "Regular": 500,
    "Insider": 1500,
    "Inner Circle": 3000,
}

def calc_tier(lifetime_points: int) -> str:
    tier = "Guest"
    for name in TIER_ORDER:
        if lifetime_points >= TIER_THRESHOLDS[name]:
            tier = name
    return tier


def next_tier_info(lifetime_points: int) -> dict:
    current = calc_tier(lifetime_points)
    idx = TIER_ORDER.index(current)
    if idx == len(TIER_ORDER) - 1:
        return {"current": current, "next": None, "points_to_next": 0, "progress_percent": 100}
    nxt = TIER_ORDER[idx + 1]
    needed = TIER_THRESHOLDS[nxt] - lifetime_points
    span = TIER_THRESHOLDS[nxt] - TIER_THRESHOLDS[current]
    progressed = lifetime_points - TIER_THRESHOLDS[current]
    return {
        "current": current,
        "next": nxt,
        "points_to_next": max(needed, 0),
        "progress_percent": int(min(100, max(0, (progressed / span) * 100))),
    }


# ---------------------------------------------------------------------------
# Razorpay helpers — booking deposits
# ---------------------------------------------------------------------------
def razorpay_configured() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


def create_razorpay_order(amount_rupees: int, receipt: str) -> dict:
    resp = requests.post(
        f"{RAZORPAY_API_BASE}/orders",
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        json={"amount": amount_rupees * 100, "currency": "INR", "receipt": receipt},
        timeout=10,
    )
    if resp.status_code >= 300:
        logger.error("Razorpay order creation failed: %s", resp.text)
        raise HTTPException(status_code=502, detail="Could not start payment right now.")
    return resp.json()


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    payload = f"{order_id}|{payment_id}".encode("utf-8")
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def refund_razorpay_payment(payment_id: str) -> None:
    resp = requests.post(
        f"{RAZORPAY_API_BASE}/payments/{payment_id}/refund",
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        json={},
        timeout=10,
    )
    if resp.status_code >= 300:
        logger.error("Razorpay refund failed for %s: %s", payment_id, resp.text)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 12,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_staff_or_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="Staff access required")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class ProfileUpdateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CheckInIn(BaseModel):
    item_ordered: Optional[str] = None
    would_return: Optional[bool] = None


class RedeemIn(BaseModel):
    venue_id: str
    reward_id: str


class StatusIn(BaseModel):
    status: Literal["Quiet", "Filling In", "At Capacity"]
    capacity_percent: Optional[int] = None


class QueueIn(BaseModel):
    queue_length: int = Field(ge=0, le=200)
    wait_minutes: Optional[int] = Field(default=None, ge=0, le=600)


class AvailabilityIn(BaseModel):
    availability: Literal["accepting", "fully_booked", "closed"]


class VenueProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    cuisine: Optional[str] = Field(default=None, max_length=60)
    price_level: int = Field(ge=1, le=4)
    neighborhood: str = Field(min_length=1, max_length=60)
    hours: str = Field(min_length=1, max_length=60)
    tagline: str = Field(min_length=1, max_length=140)
    description: str = Field(min_length=1, max_length=1000)
    image_url: str = Field(min_length=1)
    chef: Optional[str] = Field(default=None, max_length=80)
    vibes: List[str] = Field(default_factory=list)
    regulars_order: List[str] = Field(default_factory=list)


class PublishIn(BaseModel):
    published: bool


class RestaurantRegisterIn(BaseModel):
    owner_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6)
    restaurant_name: str = Field(min_length=1, max_length=80)
    cuisine: Optional[str] = Field(default=None, max_length=60)
    neighborhood: str = Field(min_length=1, max_length=60)


class AdminVenueIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    cuisine: Optional[str] = Field(default=None, max_length=60)
    neighborhood: str = Field(min_length=1, max_length=60)


class PayoutDetailsIn(BaseModel):
    legal_name: str = Field(min_length=1, max_length=120)
    business_type: Literal["proprietorship", "partnership", "llp", "private_limited", "public_limited", "other"]
    pan: Optional[str] = Field(default=None, pattern=r"^[A-Za-z]{5}[0-9]{4}[A-Za-z]$")
    gstin: Optional[str] = Field(default=None, pattern=r"^$|^[0-9A-Za-z]{15}$")
    account_holder: str = Field(min_length=1, max_length=120)
    account_number: Optional[str] = Field(default=None, pattern=r"^[0-9]{9,18}$")
    ifsc: str = Field(pattern=r"^[A-Za-z]{4}0[A-Za-z0-9]{6}$")
    bank_name: str = Field(min_length=1, max_length=80)
    upi_id: Optional[str] = Field(default=None, max_length=80)
    contact_email: EmailStr
    contact_phone: str = Field(pattern=r"^[0-9]{10}$")


class RazorpayLinkIn(BaseModel):
    # Empty string unlinks the venue.
    razorpay_account_id: str = Field(pattern=r"^$|^acc_[A-Za-z0-9]+$")


class QrSlugIn(BaseModel):
    qr_slug: str = Field(min_length=3, max_length=40, pattern=r"^[a-z0-9-]+$")


class EventIn(BaseModel):
    title: str
    description: str
    date: str  # ISO date
    time: str  # e.g. "21:00"
    tier_required: Optional[Literal["Guest", "Regular", "Insider", "Inner Circle"]] = None
    capacity: Optional[int] = Field(default=None, ge=1, le=500)
    image_url: Optional[str] = Field(default=None, max_length=500)


class OfferingFeedbackIn(BaseModel):
    checkin_id: str
    item_ordered: str
    would_return: bool


class ConciergeIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    request_type: Literal["hold_table", "preview_menu", "request"]
    party_size: Optional[int] = None
    arrival_time: Optional[str] = None


class ConciergeUpdateIn(BaseModel):
    status: Literal["acknowledged", "declined", "fulfilled"]
    response: Optional[str] = None


class BookingIn(BaseModel):
    venue_id: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    party_size: int = Field(ge=1, le=20)
    note: Optional[str] = Field(default=None, max_length=280)


class BookingUpdateIn(BaseModel):
    status: Literal["confirmed", "declined", "seated"]
    staff_reply: Optional[str] = None


class BookingDepositIn(BaseModel):
    amount: int = Field(ge=0, le=100000)


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class LoyaltyRewardIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=280)
    cost: int = Field(ge=1, le=100000)
    tier_required: str = "Guest"

    @field_validator("tier_required")
    @classmethod
    def _valid_tier(cls, v):
        if v not in TIER_ORDER:
            raise ValueError(f"tier_required must be one of {TIER_ORDER}")
        return v


class LoyaltyConfigIn(BaseModel):
    points_per_checkin: int = Field(ge=0, le=100000)
    points_per_booking: int = Field(ge=0, le=100000)
    rewards: List[LoyaltyRewardIn] = Field(default_factory=list)


class LoyaltyRedeemIn(BaseModel):
    reward_id: str


class LoyaltyRedemptionUpdateIn(BaseModel):
    redeemed: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _now_iso() -> str:
    return _iso(datetime.now(timezone.utc))


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u.get("role", "member"),
        "ritual_points_balance": u.get("ritual_points_balance", 0),
        "lifetime_points": u.get("lifetime_points", 0),
        "tier": u.get("tier", "Guest"),
        "member_since": u.get("member_since"),
        "staff_venue_id": u.get("staff_venue_id"),
    }


async def resolve_venue(ref: str, projection: Optional[dict] = None) -> Optional[dict]:
    """Look a venue up by its id, falling back to its editable qr_slug."""
    venue = await db.venues.find_one({"id": ref}, projection)
    if venue:
        return venue
    return await db.venues.find_one({"qr_slug": ref}, projection)


def _venue_loyalty_key(member_id: str, venue_id: str) -> str:
    return f"{member_id}:{venue_id}"


async def award_venue_points(member_id: str, venue_id: str, venue_name: str, amount: int, description: str) -> dict:
    """Credit venue-specific loyalty points. These are separate from the Table Points
    ledger (also redeemable only at its own venue) and are configured by staff."""
    if amount <= 0:
        account = await db.venue_loyalty.find_one(
            {"member_id": member_id, "venue_id": venue_id}, {"_id": 0}
        )
        return account or {"balance": 0, "lifetime_points": 0}

    key = _venue_loyalty_key(member_id, venue_id)
    now = _now_iso()
    await db.venue_loyalty.update_one(
        {"id": key},
        {
            "$setOnInsert": {
                "id": key,
                "member_id": member_id,
                "venue_id": venue_id,
                "venue_name": venue_name,
            },
            "$inc": {"balance": amount, "lifetime_points": amount},
            "$set": {"updated_at": now},
        },
        upsert=True,
    )
    await db.venue_loyalty_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": member_id,
        "venue_id": venue_id,
        "venue_name": venue_name,
        "points_delta": amount,
        "type": "earn",
        "description": description,
        "timestamp": now,
    })
    return await db.venue_loyalty.find_one({"id": key}, {"_id": 0})


def public_loyalty_config(venue: dict) -> dict:
    return {
        "points_per_checkin": venue.get("loyalty_points_per_checkin", 0),
        "points_per_booking": venue.get("loyalty_points_per_booking", 0),
        "rewards": venue.get("loyalty_rewards", []),
    }


async def recompute_signature_offerings(venue_id: str) -> None:
    """Rebuild venue.signature_offerings from checkin feedback (would_return=true)."""
    pipeline = [
        {"$match": {"venue_id": venue_id, "would_return": True, "item_ordered": {"$ne": None}}},
        {"$group": {"_id": "$item_ordered", "order_count": {"$sum": 1}}},
        {"$sort": {"order_count": -1}},
        {"$limit": 8},
    ]
    aggregated = await db.checkins.aggregate(pipeline).to_list(20)

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return
    seed_offerings = {o["name"]: o for o in venue.get("seed_offerings", [])}
    # Merge counts: seed count + earned count
    merged = {}
    for name, o in seed_offerings.items():
        merged[name] = {"name": name, "order_count": o.get("order_count", 0)}
    for row in aggregated:
        name = row["_id"]
        if name in merged:
            merged[name]["order_count"] += row["order_count"]
        else:
            merged[name] = {"name": name, "order_count": row["order_count"]}
    offerings = sorted(merged.values(), key=lambda x: x["order_count"], reverse=True)
    await db.venues.update_one(
        {"id": venue_id}, {"$set": {"signature_offerings": offerings}}
    )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    now = _now_iso()
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": "member",
        "ritual_points_balance": 0,
        "lifetime_points": 0,
        "tier": "Guest",
        "member_since": now,
        "created_at": now,
    }
    await db.users.insert_one(user)
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(user)


def _slugify(raw: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")[:30] or "venue"


def _draft_venue(name: str, cuisine: Optional[str], neighborhood: str, source: str) -> dict:
    """An unpublished restaurant with placeholder copy, ready to fill in from the staff dashboard."""
    now = _now_iso()
    base = _slugify(name)
    suffix = uuid.uuid4().hex[:4]
    return {
        "id": f"venue-{base}-{suffix}",
        "source": source,
        "name": name.strip(),
        "type": "Restaurant",
        "cuisine": (cuisine or "").strip() or None,
        "price_level": 2,
        "neighborhood": neighborhood.strip(),
        "daypart": "both",
        "status": "Quiet",
        "capacity_percent": 25,
        "queue_length": 0,
        "wait_minutes": None,
        "hours": "12:00 – 23:00",
        "tagline": "A new table on Table.",
        "description": "Tell members what makes your restaurant special.",
        "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": None,
        "vibes": [],
        "seed_offerings": [],
        "signature_offerings": [],
        "regulars_order": [],
        "featured": False,
        "published": False,
        "availability": "accepting",
        "qr_slug": f"{base}-{suffix}",
        "last_status_update": now,
        "created_at": now,
        "loyalty_points_per_checkin": 50,
        "loyalty_points_per_booking": 30,
        "loyalty_rewards": [],
    }


@api.post("/auth/register-restaurant")
async def register_restaurant(payload: RestaurantRegisterIn, response: Response):
    """Create a restaurant (unpublished draft) plus its staff login in one step."""
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    venue = _draft_venue(payload.restaurant_name, payload.cuisine, payload.neighborhood, "registered")
    venue_id = venue["id"]
    now = venue["created_at"]
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.owner_name.strip(),
        "role": "staff",
        "staff_venue_id": venue_id,
        "created_at": now,
    }
    await db.venues.insert_one(venue)
    await db.users.insert_one(user)
    set_auth_cookies(response, create_access_token(user["id"], email), create_refresh_token(user["id"]))
    return public_user(user)


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------------------
# Venue endpoints
# ---------------------------------------------------------------------------
@api.get("/venues")
async def list_venues(daypart: Optional[str] = None):
    query: dict = {"published": {"$ne": False}}
    if daypart and daypart.lower() in ("day", "night"):
        query["daypart"] = {"$in": [daypart.lower(), "both"]}
    venues = await db.venues.find(query, {"_id": 0, "seed_offerings": 0}).to_list(200)
    # Custom sort: featured first, then name
    venues.sort(key=lambda v: (not v.get("featured", False), v["name"]))
    return venues


@api.get("/events")
async def list_events(request: Request):
    try:
        viewer = await get_current_user(request)
    except HTTPException:
        viewer = None
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    events = await db.events.find({"date": {"$gte": today}}, {"_id": 0}).to_list(100)
    events.sort(key=lambda e: (e["date"], e["time"]))
    events = events[:12]
    event_ids = [e["id"] for e in events]
    counts = {
        r["_id"]: r["n"]
        async for r in db.event_rsvps.aggregate([
            {"$match": {"event_id": {"$in": event_ids}}},
            {"$group": {"_id": "$event_id", "n": {"$sum": 1}}},
        ])
    }
    mine = set()
    if viewer:
        mine = {
            r["event_id"]
            async for r in db.event_rsvps.find(
                {"event_id": {"$in": event_ids}, "member_id": viewer["id"]}, {"_id": 0, "event_id": 1}
            )
        }
    for e in events:
        e["rsvp_count"] = counts.get(e["id"], 0)
        e["my_rsvp"] = e["id"] in mine
    venue_ids = list({e["venue_id"] for e in events})
    venues = await db.venues.find(
        {"id": {"$in": venue_ids}}, {"_id": 0, "id": 1, "name": 1, "neighborhood": 1, "image_url": 1}
    ).to_list(len(venue_ids) or 1)
    venue_map = {v["id"]: v for v in venues}
    for e in events:
        v = venue_map.get(e["venue_id"])
        if v:
            e["venue_name"] = v["name"]
            e["venue_neighborhood"] = v.get("neighborhood")
            e["venue_image_url"] = e.get("image_url") or v.get("image_url")
    return events


@api.post("/events/{event_id}/rsvp")
async def toggle_rsvp(event_id: str, user: dict = Depends(get_current_user)):
    """One-tap RSVP: reserves a seat, or cancels it if already reserved."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    key = {"event_id": event_id, "member_id": user["id"]}
    if await db.event_rsvps.find_one(key):
        await db.event_rsvps.delete_one(key)
        going = False
    else:
        required = event.get("tier_required")
        if required and TIER_ORDER.index(user.get("tier", "Guest")) < TIER_ORDER.index(required):
            raise HTTPException(status_code=403, detail=f"This event is for {required} members and above")
        capacity = event.get("capacity")
        if capacity and await db.event_rsvps.count_documents({"event_id": event_id}) >= capacity:
            raise HTTPException(status_code=409, detail="This event is full")
        await db.event_rsvps.insert_one({**key, "created_at": _now_iso()})
        going = True
    return {"going": going, "rsvp_count": await db.event_rsvps.count_documents({"event_id": event_id})}


@api.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await resolve_venue(venue_id, {"_id": 0, "seed_offerings": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    events = await db.events.find({"venue_id": venue["id"]}, {"_id": 0}).to_list(50)
    events.sort(key=lambda e: (e["date"], e["time"]))
    venue["events"] = events
    return venue


@api.post("/venues/{venue_id}/checkin")
async def checkin(venue_id: str, payload: CheckInIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("member", "admin"):
        raise HTTPException(status_code=403, detail="Only members can check in")
    venue = await resolve_venue(venue_id, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue_id = venue["id"]

    now = _now_iso()
    checkin_id = str(uuid.uuid4())
    await db.checkins.insert_one({
        "id": checkin_id,
        "member_id": user["id"],
        "venue_id": venue_id,
        "timestamp": now,
        "item_ordered": payload.item_ordered,
        "would_return": payload.would_return,
    })

    # Award points
    delta = POINTS_PER_CHECKIN
    new_balance = user.get("ritual_points_balance", 0) + delta
    new_lifetime = user.get("lifetime_points", 0) + delta
    new_tier = calc_tier(new_lifetime)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "ritual_points_balance": new_balance,
            "lifetime_points": new_lifetime,
            "tier": new_tier,
        }},
    )
    await db.points_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": user["id"],
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "points_delta": delta,
        "type": "earn",
        "description": f"Check-in at {venue['name']}",
        "timestamp": now,
    })

    if payload.item_ordered and payload.would_return:
        await recompute_signature_offerings(venue_id)

    venue_points_earned = venue.get("loyalty_points_per_checkin", 0)
    venue_account = await award_venue_points(
        user["id"], venue_id, venue["name"], venue_points_earned, f"Dined in at {venue['name']}"
    )

    return {
        "checkin_id": checkin_id,
        "points_earned": delta,
        "balance": new_balance,
        "lifetime_points": new_lifetime,
        "tier": new_tier,
        "venue_name": venue["name"],
        "venue_points_earned": venue_points_earned,
        "venue_points_balance": venue_account.get("balance", 0),
    }


@api.post("/checkins/feedback")
async def checkin_feedback(payload: OfferingFeedbackIn, user: dict = Depends(get_current_user)):
    ci = await db.checkins.find_one({"id": payload.checkin_id}, {"_id": 0})
    if not ci or ci["member_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Check-in not found")
    await db.checkins.update_one(
        {"id": payload.checkin_id},
        {"$set": {"item_ordered": payload.item_ordered, "would_return": payload.would_return}},
    )
    if payload.would_return:
        await recompute_signature_offerings(ci["venue_id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Wallet endpoints
# ---------------------------------------------------------------------------
async def venue_point_balances(member_id: str) -> dict:
    """Spendable Table Points per restaurant, derived from the ledger.

    Every ledger row carries the venue where the points were earned or spent, so a member's balance
    at one restaurant is the sum of its rows. Points can only be redeemed at the restaurant that issued them.
    """
    rows = await db.points_ledger.aggregate([
        {"$match": {"member_id": member_id, "venue_id": {"$ne": None}}},
        {"$group": {"_id": "$venue_id", "balance": {"$sum": "$points_delta"}, "venue_name": {"$last": "$venue_name"}}},
    ]).to_list(500)
    return {r["_id"]: {"balance": r["balance"], "venue_name": r["venue_name"]} for r in rows}


@api.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    balances = await venue_point_balances(user["id"])
    spendable = {vid: b for vid, b in balances.items() if b["balance"] > 0}
    venue_docs = await db.venues.find(
        {"id": {"$in": list(spendable)}}, {"_id": 0, "id": 1, "name": 1, "image_url": 1, "neighborhood": 1}
    ).to_list(500)
    venue_by_id = {v["id"]: v for v in venue_docs}
    venue_balances = sorted(
        (
            {
                "venue_id": vid,
                "venue_name": venue_by_id.get(vid, {}).get("name") or b["venue_name"],
                "image_url": venue_by_id.get(vid, {}).get("image_url"),
                "neighborhood": venue_by_id.get(vid, {}).get("neighborhood"),
                "balance": b["balance"],
            }
            for vid, b in spendable.items()
            if vid in venue_by_id  # a restaurant that has left the network can't honour points
        ),
        key=lambda x: -x["balance"],
    )
    ledger = await db.points_ledger.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(200)
    tier_info = next_tier_info(user.get("lifetime_points", 0))
    checkins_count = await db.checkins.count_documents({"member_id": user["id"]})
    return {
        "balance": user.get("ritual_points_balance", 0),
        "lifetime_points": user.get("lifetime_points", 0),
        "tier": tier_info["current"],
        "next_tier": tier_info["next"],
        "points_to_next": tier_info["points_to_next"],
        "progress_percent": tier_info["progress_percent"],
        "visits": checkins_count,
        "venues": venue_balances,
        "ledger": ledger,
    }


@api.post("/wallet/redeem")
async def redeem(payload: RedeemIn, user: dict = Depends(get_current_user)):
    venue = await db.venues.find_one({"id": payload.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    # Perks are whatever this restaurant has configured as rewards.
    reward = next((r for r in venue.get("loyalty_rewards", []) if r["id"] == payload.reward_id), None)
    if not reward:
        raise HTTPException(status_code=404, detail="Perk not found")
    perk = {
        "code": reward["id"],
        "name": reward["name"],
        "description": reward.get("description", ""),
        "cost": reward["cost"],
        "tier_required": reward.get("tier_required", "Guest"),
    }
    # Tier gate — checked BEFORE balance so a tier violation reads clearly
    user_tier_idx = TIER_ORDER.index(user.get("tier", "Guest"))
    perk_tier_idx = TIER_ORDER.index(perk["tier_required"])
    if user_tier_idx < perk_tier_idx:
        raise HTTPException(
            status_code=403,
            detail=f"This perk is reserved for {perk['tier_required']} and above",
        )

    # Points are bound to the restaurant that issued them: only this venue's balance counts.
    balances = await venue_point_balances(user["id"])
    venue_balance = max(0, balances.get(venue["id"], {}).get("balance", 0))
    if venue_balance < perk["cost"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"You have {venue_balance} points at {venue['name']}; {perk['name']} costs {perk['cost']}. "
                "Table Points can only be redeemed at the restaurant where you earned them."
            ),
        )

    now = _now_iso()
    debit = await db.users.update_one(
        {"id": user["id"], "ritual_points_balance": {"$gte": perk["cost"]}},
        {"$inc": {"ritual_points_balance": -perk["cost"]}},
    )
    if debit.matched_count == 0:
        raise HTTPException(status_code=400, detail="Not enough Table Points")
    new_balance = user.get("ritual_points_balance", 0) - perk["cost"]
    redemption_code = "R-" + uuid.uuid4().hex[:8].upper()
    ledger_id = str(uuid.uuid4())
    await db.points_ledger.insert_one({
        "id": ledger_id,
        "member_id": user["id"],
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "points_delta": -perk["cost"],
        "type": "redeem",
        "description": f"{perk['name']} at {venue['name']}",
        "timestamp": now,
    })
    # Two simultaneous redemptions could both pass the check above; if this venue's balance went
    # negative the debit we just wrote overspent it, so undo it.
    after = await venue_point_balances(user["id"])
    if after.get(venue["id"], {}).get("balance", 0) < 0:
        await db.points_ledger.delete_one({"id": ledger_id})
        await db.users.update_one({"id": user["id"]}, {"$inc": {"ritual_points_balance": perk["cost"]}})
        raise HTTPException(status_code=409, detail="Your points changed while redeeming. Please try again.")
    redemption = {
        "id": str(uuid.uuid4()),
        "code": redemption_code,
        "member_id": user["id"],
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "perk_code": perk["code"],
        "perk_name": perk["name"],
        "perk_description": perk["description"],
        "points_cost": perk["cost"],
        "timestamp": now,
        "redeemed": False,
    }
    await db.redemptions.insert_one(redemption)
    return {
        "redemption": {k: v for k, v in redemption.items() if k != "_id"},
        "balance": new_balance,
    }


@api.get("/wallet/redemptions")
async def my_redemptions(user: dict = Depends(get_current_user)):
    items = await db.redemptions.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    return items


# ---------------------------------------------------------------------------
# Member profile
# ---------------------------------------------------------------------------
@api.patch("/members/me")
async def update_my_profile(payload: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
    return public_user({**user, "name": name})


@api.get("/members/me/history")
async def my_history(user: dict = Depends(get_current_user)):
    checkins = await db.checkins.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    venue_ids = list({c["venue_id"] for c in checkins})
    venues = await db.venues.find(
        {"id": {"$in": venue_ids}}, {"_id": 0, "id": 1, "name": 1, "type": 1, "image_url": 1, "neighborhood": 1}
    ).to_list(100)
    vmap = {v["id"]: v for v in venues}
    for c in checkins:
        v = vmap.get(c["venue_id"], {})
        c["venue_name"] = v.get("name")
        c["venue_type"] = v.get("type")
        c["venue_image"] = v.get("image_url")
        c["venue_neighborhood"] = v.get("neighborhood")
    return checkins


# ---------------------------------------------------------------------------
# Staff endpoints
# ---------------------------------------------------------------------------
@api.get("/staff/venues")
async def staff_venues(user: dict = Depends(require_staff_or_admin)):
    if user.get("role") == "admin":
        venues = await db.venues.find({}, {"_id": 0, "seed_offerings": 0}).to_list(200)
    else:
        vid = user.get("staff_venue_id")
        venues = await db.venues.find({"id": vid}, {"_id": 0, "seed_offerings": 0}).to_list(10)
    return venues


@api.post("/admin/venues", status_code=201)
async def admin_create_venue(payload: AdminVenueIn, user: dict = Depends(require_admin)):
    """Add a restaurant as an unpublished draft; details are filled in from the staff dashboard."""
    venue = _draft_venue(payload.name, payload.cuisine, payload.neighborhood, "admin")
    await db.venues.insert_one(venue)
    venue.pop("_id", None)
    venue.pop("seed_offerings", None)
    return venue


@api.delete("/admin/venues/{venue_id}")
async def admin_delete_venue(venue_id: str, user: dict = Depends(require_admin)):
    result = await db.venues.delete_one({"id": venue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    # Check-ins, ledger and bookings keep their copied venue_name for history.
    await db.events.delete_many({"venue_id": venue_id})
    await db.users.update_many({"staff_venue_id": venue_id}, {"$set": {"staff_venue_id": None}})
    return {"ok": True}


def _assert_staff_can_manage(user: dict, venue_id: str) -> None:
    if user.get("role") == "admin":
        return
    if user.get("staff_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")


@api.patch("/staff/venues/{venue_id}/status")
async def update_status(venue_id: str, payload: StatusIn, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    updates: dict = {"status": payload.status, "last_status_update": _now_iso()}
    if payload.capacity_percent is not None:
        updates["capacity_percent"] = max(0, min(100, payload.capacity_percent))
    else:
        # sensible mapping
        cap_map = {"Quiet": 25, "Filling In": 65, "At Capacity": 100}
        updates["capacity_percent"] = cap_map[payload.status]
    result = await db.venues.update_one({"id": venue_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, **updates}


@api.patch("/staff/venues/{venue_id}/queue")
async def update_queue(venue_id: str, payload: QueueIn, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    updates: dict = {
        "queue_length": payload.queue_length,
        "wait_minutes": payload.wait_minutes,
        "last_status_update": _now_iso(),
    }
    result = await db.venues.update_one({"id": venue_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, **updates}


@api.patch("/staff/venues/{venue_id}/availability")
async def update_availability(
    venue_id: str, payload: AvailabilityIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    updates: dict = {"availability": payload.availability, "last_status_update": _now_iso()}
    result = await db.venues.update_one({"id": venue_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, **updates}


@api.patch("/staff/venues/{venue_id}/profile")
async def update_profile(
    venue_id: str, payload: VenueProfileIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    updates = payload.model_dump()
    result = await db.venues.update_one({"id": venue_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, **updates}


# ---------------------------------------------------------------------------
# Venue photos (food, recipes, restaurant) — stored on local disk, served at /api/uploads
# ---------------------------------------------------------------------------
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
PHOTO_CATEGORIES = ("food", "recipe", "restaurant", "menu")
PHOTO_MAX_BYTES = 8 * 1024 * 1024
PHOTO_MAX_PER_VENUE = 60
# Sniffed from file bytes — never trust the client-supplied content type or filename.
PHOTO_SIGNATURES = (
    (b"\xff\xd8\xff", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"GIF8", "gif"),
)


PHOTO_MAX_EDGE = 1600
PHOTO_THUMB_EDGE = 480
Image.MAX_IMAGE_PIXELS = 50_000_000  # reject decompression bombs


def _process_photo(data: bytes) -> tuple:
    """Decode, fix orientation, strip metadata, and return (full, thumb) WebP bytes.
    Animated GIFs are kept as-is (re-encoding would drop the animation)."""
    img = Image.open(BytesIO(data))
    if img.format == "GIF" and getattr(img, "is_animated", False):
        return data, None
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")

    def encode(edge: int, quality: int) -> bytes:
        copy = img.copy()
        copy.thumbnail((edge, edge), Image.LANCZOS)
        out = BytesIO()
        copy.save(out, "WEBP", quality=quality, method=4)
        return out.getvalue()

    return encode(PHOTO_MAX_EDGE, 82), encode(PHOTO_THUMB_EDGE, 75)


def _sniff_image_ext(data: bytes) -> Optional[str]:
    for sig, ext in PHOTO_SIGNATURES:
        if data.startswith(sig):
            return ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


@api.post("/staff/venues/{venue_id}/photos")
async def upload_venue_photo(
    venue_id: str,
    file: UploadFile = File(...),
    category: str = Form("food"),
    caption: str = Form(""),
    user: dict = Depends(require_staff_or_admin),
):
    _assert_staff_can_manage(user, venue_id)
    if category not in PHOTO_CATEGORIES:
        raise HTTPException(status_code=400, detail="Category must be food, recipe, restaurant or menu")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "photos": 1})
    if venue is None:  # not `not venue`: a venue with no photos yet projects to an empty dict
        raise HTTPException(status_code=404, detail="Venue not found")
    if len(venue.get("photos") or []) >= PHOTO_MAX_PER_VENUE:
        raise HTTPException(status_code=400, detail=f"Photo limit reached ({PHOTO_MAX_PER_VENUE})")
    data = await file.read(PHOTO_MAX_BYTES + 1)
    if len(data) > PHOTO_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo must be 8 MB or smaller")
    ext = _sniff_image_ext(data)
    if not ext:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG, WebP or GIF image")
    try:
        full, thumb = await run_in_threadpool(_process_photo, data)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(status_code=400, detail="That image could not be read. Try another file.")
    photo_id = str(uuid.uuid4())
    vdir = UPLOAD_DIR / venue_id
    vdir.mkdir(parents=True, exist_ok=True)
    if thumb is None:  # animated GIF kept as uploaded
        full_name, thumb_name = f"{photo_id}.gif", None
    else:
        full_name, thumb_name = f"{photo_id}.webp", f"{photo_id}_t.webp"
        (vdir / thumb_name).write_bytes(thumb)
    (vdir / full_name).write_bytes(full)
    photo = {
        "id": photo_id,
        "url": f"/api/uploads/{venue_id}/{full_name}",
        "thumb_url": f"/api/uploads/{venue_id}/{thumb_name}" if thumb_name else f"/api/uploads/{venue_id}/{full_name}",
        "category": category,
        "caption": caption.strip()[:140],
        "uploaded_at": _now_iso(),
    }
    await db.venues.update_one({"id": venue_id}, {"$push": {"photos": photo}})
    return photo


@api.delete("/staff/venues/{venue_id}/photos/{photo_id}")
async def delete_venue_photo(venue_id: str, photo_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "photos": 1})
    photo = next((p for p in (venue or {}).get("photos") or [] if p["id"] == photo_id), None)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    await db.venues.update_one({"id": venue_id}, {"$pull": {"photos": {"id": photo_id}}})
    for key in ("url", "thumb_url"):
        if photo.get(key):
            (UPLOAD_DIR / venue_id / Path(photo[key]).name).unlink(missing_ok=True)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Venue menu — sections of dishes, edited by staff and shown on the venue page
# ---------------------------------------------------------------------------
class MenuItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=240)
    price: float = Field(ge=0, le=100000)
    veg: Optional[bool] = None  # True = vegetarian, False = non-vegetarian, None = not specified
    photo_url: Optional[str] = Field(default=None, max_length=500)


class MenuSectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    items: List[MenuItemIn] = Field(default_factory=list, max_length=80)


class MenuIn(BaseModel):
    sections: List[MenuSectionIn] = Field(default_factory=list, max_length=20)


def build_menu(payload: MenuIn) -> list:
    return [
        {
            "id": str(uuid.uuid4()),
            "name": sec.name.strip(),
            "items": [
                {
                    "id": str(uuid.uuid4()),
                    "name": it.name.strip(),
                    "description": it.description.strip(),
                    "price": round(it.price, 2),
                    "veg": it.veg,
                    "photo_url": (it.photo_url or "").strip() or None,
                }
                for it in sec.items
            ],
        }
        for sec in payload.sections
    ]


@api.put("/staff/venues/{venue_id}/menu")
async def update_menu(venue_id: str, payload: MenuIn, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    menu = build_menu(payload)
    result = await db.venues.update_one({"id": venue_id}, {"$set": {"menu": menu}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, "menu": menu}


@api.patch("/staff/venues/{venue_id}/booking-deposit")
async def update_booking_deposit(
    venue_id: str, payload: BookingDepositIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    result = await db.venues.update_one(
        {"id": venue_id}, {"$set": {"booking_deposit_amount": payload.amount}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, "booking_deposit_amount": payload.amount}


@api.patch("/staff/venues/{venue_id}/qr-slug")
async def update_qr_slug(
    venue_id: str, payload: QrSlugIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    slug = payload.qr_slug.strip().lower()
    existing = await db.venues.find_one({"qr_slug": slug, "id": {"$ne": venue_id}}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="That check-in address is already in use")
    result = await db.venues.update_one({"id": venue_id}, {"$set": {"qr_slug": slug}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, "qr_slug": slug}


@api.patch("/staff/venues/{venue_id}/publish")
async def update_publish(
    venue_id: str, payload: PublishIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    result = await db.venues.update_one({"id": venue_id}, {"$set": {"published": payload.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, "published": payload.published}


# --- Payout details (Razorpay Route linked-account onboarding) --------------
# Stored in their own collection, never on the venue document, because the
# public /venues endpoints return venue documents wholesale.
def _encrypt(value: str) -> str:
    return payout_cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def public_payout(doc: Optional[dict]) -> dict:
    if not doc:
        return {"status": "not_submitted", "razorpay_account_id": None}
    return {
        "status": doc.get("status", "submitted"),
        "razorpay_account_id": doc.get("razorpay_account_id"),
        "legal_name": doc.get("legal_name"),
        "business_type": doc.get("business_type"),
        "pan_last4": doc.get("pan_last4"),
        "gstin": doc.get("gstin"),
        "account_holder": doc.get("account_holder"),
        "account_last4": doc.get("account_last4"),
        "ifsc": doc.get("ifsc"),
        "bank_name": doc.get("bank_name"),
        "upi_id": doc.get("upi_id"),
        "contact_email": doc.get("contact_email"),
        "contact_phone": doc.get("contact_phone"),
        "submitted_at": doc.get("submitted_at"),
        "updated_at": doc.get("updated_at"),
    }


@api.get("/staff/venues/{venue_id}/payout")
async def get_payout(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    doc = await db.venue_payouts.find_one({"venue_id": venue_id}, {"_id": 0})
    return public_payout(doc)


@api.put("/staff/venues/{venue_id}/payout")
async def save_payout(
    venue_id: str, payload: PayoutDetailsIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    if not await db.venues.find_one({"id": venue_id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Venue not found")

    existing = await db.venue_payouts.find_one({"venue_id": venue_id}, {"_id": 0})
    # PAN and account number are never sent back to the browser, so on edit they
    # may be left blank to keep the stored value.
    if not payload.pan and not (existing and existing.get("pan_enc")):
        raise HTTPException(status_code=422, detail="PAN is required")
    if not payload.account_number and not (existing and existing.get("account_number_enc")):
        raise HTTPException(status_code=422, detail="Bank account number is required")

    now = _now_iso()
    doc = {
        "venue_id": venue_id,
        "legal_name": payload.legal_name.strip(),
        "business_type": payload.business_type,
        "gstin": (payload.gstin or "").upper() or None,
        "account_holder": payload.account_holder.strip(),
        "ifsc": payload.ifsc.upper(),
        "bank_name": payload.bank_name.strip(),
        "upi_id": (payload.upi_id or "").strip() or None,
        "contact_email": payload.contact_email.lower(),
        "contact_phone": payload.contact_phone,
        "updated_at": now,
    }
    if payload.pan:
        doc["pan_enc"] = _encrypt(payload.pan.upper())
        doc["pan_last4"] = payload.pan[-4:].upper()
    if payload.account_number:
        doc["account_number_enc"] = _encrypt(payload.account_number)
        doc["account_last4"] = payload.account_number[-4:]

    if not existing:
        doc["status"] = "submitted"
        doc["submitted_at"] = now
    else:
        # Changing the legal/bank identity of an already-linked venue needs re-verification.
        identity_changed = bool(payload.pan or payload.account_number) or any(
            doc[k] != existing.get(k) for k in ("legal_name", "ifsc", "account_holder")
        )
        if existing.get("status") == "active" and identity_changed:
            doc["status"] = "submitted"

    await db.venue_payouts.update_one({"venue_id": venue_id}, {"$set": doc}, upsert=True)
    saved = await db.venue_payouts.find_one({"venue_id": venue_id}, {"_id": 0})
    return public_payout(saved)


@api.patch("/staff/venues/{venue_id}/payout/razorpay-account")
async def link_razorpay_account(
    venue_id: str, payload: RazorpayLinkIn, user: dict = Depends(require_staff_or_admin)
):
    """Admin-only: record the Razorpay linked-account id (acc_...) once onboarding is done."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    doc = await db.venue_payouts.find_one({"venue_id": venue_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="This venue has not submitted payout details yet")
    acc = payload.razorpay_account_id.strip()
    await db.venue_payouts.update_one(
        {"venue_id": venue_id},
        {"$set": {
            "razorpay_account_id": acc or None,
            "status": "active" if acc else "submitted",
            "updated_at": _now_iso(),
        }},
    )
    return public_payout(await db.venue_payouts.find_one({"venue_id": venue_id}, {"_id": 0}))


@api.get("/staff/venues/{venue_id}/analytics")
async def venue_analytics(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    checkins_week = await db.checkins.count_documents(
        {"venue_id": venue_id, "timestamp": {"$gte": week_ago}}
    )
    checkins_total = await db.checkins.count_documents({"venue_id": venue_id})

    issued = await db.points_ledger.aggregate([
        {"$match": {"venue_id": venue_id, "type": "earn"}},
        {"$group": {"_id": None, "total": {"$sum": "$points_delta"}}},
    ]).to_list(1)
    redeemed = await db.points_ledger.aggregate([
        {"$match": {"venue_id": venue_id, "type": "redeem"}},
        {"$group": {"_id": None, "total": {"$sum": "$points_delta"}}},
    ]).to_list(1)
    points_issued = issued[0]["total"] if issued else 0
    points_redeemed = -redeemed[0]["total"] if redeemed else 0

    top_offerings_pipeline = [
        {"$match": {"venue_id": venue_id, "item_ordered": {"$ne": None}, "would_return": True}},
        {"$group": {"_id": "$item_ordered", "return_count": {"$sum": 1}}},
        {"$sort": {"return_count": -1}},
        {"$limit": 5},
    ]
    top_offerings = await db.checkins.aggregate(top_offerings_pipeline).to_list(10)

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "seed_offerings": 0})

    return {
        "venue": venue,
        "checkins_week": checkins_week,
        "checkins_total": checkins_total,
        "points_issued": points_issued,
        "points_redeemed": points_redeemed,
        "top_offerings": [{"name": r["_id"], "return_count": r["return_count"]} for r in top_offerings],
    }


@api.post("/staff/venues/{venue_id}/events")
async def create_event(venue_id: str, payload: EventIn, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    event = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "title": payload.title,
        "description": payload.description,
        "date": payload.date,
        "time": payload.time,
        "tier_required": payload.tier_required,
        "capacity": payload.capacity,
        "image_url": (payload.image_url or "").strip() or None,
        "created_at": _now_iso(),
    }
    await db.events.insert_one(event)
    return {k: v for k, v in event.items() if k != "_id"}


@api.get("/staff/venues/{venue_id}/redemptions")
async def venue_redemptions(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    items = await db.redemptions.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    # Enrich with member names
    member_ids = list({r["member_id"] for r in items})
    members = await db.users.find(
        {"id": {"$in": member_ids}}, {"_id": 0, "id": 1, "name": 1, "tier": 1}
    ).to_list(200)
    mmap = {m["id"]: m for m in members}
    for r in items:
        m = mmap.get(r["member_id"], {})
        r["member_name"] = m.get("name")
        r["member_tier"] = m.get("tier")
    return items


@api.patch("/staff/venues/{venue_id}/redemptions/{redemption_id}")
async def update_perk_redemption(
    venue_id: str,
    redemption_id: str,
    payload: LoyaltyRedemptionUpdateIn,
    user: dict = Depends(require_staff_or_admin),
):
    _assert_staff_can_manage(user, venue_id)
    result = await db.redemptions.update_one(
        {"id": redemption_id, "venue_id": venue_id},
        {"$set": {"redeemed": payload.redeemed, "redeemed_at": _now_iso() if payload.redeemed else None}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Redemption not found")
    return {"ok": True, "redeemed": payload.redeemed}


# ---------------------------------------------------------------------------
# Concierge (messaging) endpoints
# ---------------------------------------------------------------------------
CONCIERGE_TYPE_LABEL = {
    "hold_table": "Hold a table",
    "preview_menu": "Preview the menu",
    "request": "A quiet request",
}


@api.post("/venues/{venue_id}/concierge")
async def create_concierge_message(
    venue_id: str,
    payload: ConciergeIn,
    user: dict = Depends(get_current_user),
):
    if user.get("role") not in ("member", "admin"):
        raise HTTPException(status_code=403, detail="Members only")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    msg = {
        "id": str(uuid.uuid4()),
        "member_id": user["id"],
        "member_name": user["name"],
        "member_tier": user.get("tier", "Guest"),
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "message": payload.message.strip(),
        "request_type": payload.request_type,
        "party_size": payload.party_size,
        "arrival_time": payload.arrival_time,
        "status": "pending",
        "response": None,
        "created_at": _now_iso(),
        "responded_at": None,
    }
    await db.concierge_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg


@api.get("/members/me/concierge")
async def my_concierge(user: dict = Depends(get_current_user)):
    items = await db.concierge_messages.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items


@api.get("/staff/venues/{venue_id}/concierge")
async def venue_concierge_inbox(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    items = await db.concierge_messages.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return items


@api.patch("/staff/concierge/{msg_id}")
async def update_concierge_message(
    msg_id: str,
    payload: ConciergeUpdateIn,
    user: dict = Depends(require_staff_or_admin),
):
    msg = await db.concierge_messages.find_one({"id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    _assert_staff_can_manage(user, msg["venue_id"])
    updates = {
        "status": payload.status,
        "responded_at": _now_iso(),
    }
    if payload.response is not None:
        updates["response"] = payload.response.strip() or None
    await db.concierge_messages.update_one({"id": msg_id}, {"$set": updates})
    return {"ok": True, **updates}


# ---------------------------------------------------------------------------
# Bookings — live reservations with confirmed codes
# ---------------------------------------------------------------------------
SLOT_CAPACITY_PER_TIME = 6  # seats-worth of parties per 30-min slot


HOURS_RANGE_RE = re.compile(r"(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})")


def _generate_slots(hours: str) -> list:
    """Parse '18:00 – 23:00', '18:00 – 01:00' or split service like
    '12:00 – 15:00 buffet, 19:00 – 23:00 à la carte' into 30-min slots.
    Labels around the ranges are ignored. Last slot of each range is
    30 min before close so a party has time to sit.
    """
    slots = []
    for sh, sm, eh, em in HOURS_RANGE_RE.findall(hours or ""):
        sh, sm, eh, em = int(sh), int(sm), int(eh), int(em)
        if eh < sh:  # crosses midnight, e.g. 18:00–01:00
            eh += 24
        cur = sh * 60 + sm
        end_min = eh * 60 + em
        while cur + 30 <= end_min:
            h = (cur // 60) % 24
            m = cur % 60
            slots.append(f"{h:02d}:{m:02d}")
            cur += 30
    return slots


PAYMENT_HOLD_MINUTES = 15  # an unpaid deposit booking holds its slot this long


def _slot_taken_filter(venue_id: str, date: str, time: str = None) -> dict:
    """Bookings that occupy a slot: live ones, plus unpaid deposit holds that haven't expired."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=PAYMENT_HOLD_MINUTES)).isoformat()
    q = {
        "venue_id": venue_id,
        "date": date,
        "$or": [
            {"status": {"$in": ["pending", "confirmed"]}},
            {"status": "awaiting_payment", "created_at": {"$gte": cutoff}},
        ],
    }
    if time:
        q["time"] = time
    return q


def _generate_booking_code() -> str:
    import secrets
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # skip lookalikes
    return "T-" + "".join(secrets.choice(alphabet) for _ in range(6))


@api.get("/venues/{venue_id}/availability")
async def venue_availability(venue_id: str, date: str, user: dict = Depends(get_current_user)):
    if not date or len(date) != 10:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    slots = _generate_slots(venue.get("hours", ""))
    booked_docs = await db.bookings.find(
        _slot_taken_filter(venue_id, date), {"_id": 0, "time": 1}
    ).to_list(500)
    booked_times = [b["time"] for b in booked_docs]
    result = []
    for s in slots:
        count = booked_times.count(s)
        result.append({
            "time": s,
            "remaining": max(0, SLOT_CAPACITY_PER_TIME - count),
            "available": count < SLOT_CAPACITY_PER_TIME,
        })
    return {"date": date, "venue_id": venue_id, "hours": venue.get("hours"), "slots": result}


@api.post("/bookings")
async def create_booking(payload: BookingIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("member", "admin"):
        raise HTTPException(status_code=403, detail="Members only")
    venue = await db.venues.find_one({"id": payload.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    slots = _generate_slots(venue.get("hours", ""))
    if slots and payload.time not in slots:
        raise HTTPException(status_code=400, detail="That time isn't offered by this room")
    taken = await db.bookings.count_documents(_slot_taken_filter(payload.venue_id, payload.date, payload.time))
    if taken >= SLOT_CAPACITY_PER_TIME:
        raise HTTPException(status_code=409, detail="That time is full — try another slot.")

    deposit_amount = venue.get("booking_deposit_amount", 0)
    requires_payment = deposit_amount > 0
    if requires_payment and not razorpay_configured():
        raise HTTPException(status_code=503, detail="Deposits aren't set up for this venue yet.")

    booking = {
        "id": str(uuid.uuid4()),
        "code": _generate_booking_code(),
        "member_id": user["id"],
        "member_name": user["name"],
        "member_tier": user.get("tier", "Guest"),
        "venue_id": payload.venue_id,
        "venue_name": venue["name"],
        "venue_neighborhood": venue.get("neighborhood"),
        "venue_image": venue.get("image_url"),
        "date": payload.date,
        "time": payload.time,
        "party_size": payload.party_size,
        "note": (payload.note or "").strip() or None,
        "status": "awaiting_payment" if requires_payment else "pending",
        "staff_reply": None,
        "created_at": _now_iso(),
        "responded_at": None,
        "deposit_amount": deposit_amount,
        "payment_status": "created" if requires_payment else "not_required",
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
    }

    razorpay_info = None
    if requires_payment:
        order = create_razorpay_order(deposit_amount, receipt=booking["id"])
        booking["razorpay_order_id"] = order["id"]
        razorpay_info = {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": RAZORPAY_KEY_ID,
        }

    await db.bookings.insert_one(booking)
    booking.pop("_id", None)
    return {"booking": booking, "requires_payment": requires_payment, "razorpay": razorpay_info}


@api.post("/bookings/{booking_id}/verify-payment")
async def verify_booking_payment(
    booking_id: str, payload: VerifyPaymentIn, user: dict = Depends(get_current_user)
):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["member_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if b["payment_status"] != "created" or b["razorpay_order_id"] != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="This booking isn't awaiting payment")

    if not verify_razorpay_signature(
        payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Payment could not be verified")

    updates = {
        "status": "pending",
        "payment_status": "paid",
        "razorpay_payment_id": payload.razorpay_payment_id,
    }
    await db.bookings.update_one({"id": booking_id}, {"$set": updates})
    b.update(updates)
    return b


@api.get("/members/me/bookings")
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items


@api.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["member_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your booking")
    if b["status"] in ("declined", "cancelled", "seated"):
        raise HTTPException(status_code=400, detail="This reservation is already resolved")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "responded_at": _now_iso()}},
    )
    return {"ok": True, "status": "cancelled"}


@api.get("/staff/venues/{venue_id}/bookings")
async def venue_bookings(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    items = await db.bookings.find(
        {"venue_id": venue_id, "status": {"$ne": "awaiting_payment"}}, {"_id": 0}
    ).sort([("date", 1), ("time", 1)]).to_list(200)
    return items


@api.patch("/staff/bookings/{booking_id}")
async def update_booking(
    booking_id: str,
    payload: BookingUpdateIn,
    user: dict = Depends(require_staff_or_admin),
):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    _assert_staff_can_manage(user, b["venue_id"])
    updates = {"status": payload.status, "responded_at": _now_iso()}
    if payload.staff_reply is not None:
        updates["staff_reply"] = payload.staff_reply.strip() or None
    await db.bookings.update_one({"id": booking_id}, {"$set": updates})

    if payload.status == "seated" and b["status"] != "seated":
        venue = await db.venues.find_one({"id": b["venue_id"]}, {"_id": 0})
        if venue:
            await award_venue_points(
                b["member_id"],
                b["venue_id"],
                venue["name"],
                venue.get("loyalty_points_per_booking", 0),
                f"Table booking at {venue['name']}",
            )

    if payload.status == "declined" and b.get("payment_status") == "paid" and b.get("razorpay_payment_id"):
        refund_razorpay_payment(b["razorpay_payment_id"])
        updates["payment_status"] = "refunded"
        await db.bookings.update_one({"id": booking_id}, {"$set": {"payment_status": "refunded"}})

    return {"ok": True, **updates}


# ---------------------------------------------------------------------------
# Venue loyalty program — points earned & spent at a single restaurant only
# ---------------------------------------------------------------------------
@api.get("/venues/{venue_id}/loyalty")
async def get_venue_loyalty(venue_id: str, user: dict = Depends(get_current_user)):
    venue = await resolve_venue(venue_id, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue_id = venue["id"]
    account = await db.venue_loyalty.find_one(
        {"member_id": user["id"], "venue_id": venue_id}, {"_id": 0}
    )
    ledger = await db.venue_loyalty_ledger.find(
        {"member_id": user["id"], "venue_id": venue_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return {
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "balance": account.get("balance", 0) if account else 0,
        "lifetime_points": account.get("lifetime_points", 0) if account else 0,
        "config": public_loyalty_config(venue),
        "ledger": ledger,
    }


@api.post("/venues/{venue_id}/loyalty/redeem")
async def redeem_venue_loyalty(
    venue_id: str, payload: LoyaltyRedeemIn, user: dict = Depends(get_current_user)
):
    venue = await resolve_venue(venue_id, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue_id = venue["id"]
    reward = next(
        (r for r in venue.get("loyalty_rewards", []) if r["id"] == payload.reward_id), None
    )
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")

    account = await db.venue_loyalty.find_one(
        {"member_id": user["id"], "venue_id": venue_id}, {"_id": 0}
    )
    balance = account.get("balance", 0) if account else 0
    if balance < reward["cost"]:
        raise HTTPException(status_code=400, detail="Not enough points at this restaurant")

    now = _now_iso()
    key = _venue_loyalty_key(user["id"], venue_id)
    await db.venue_loyalty.update_one({"id": key}, {"$inc": {"balance": -reward["cost"]}, "$set": {"updated_at": now}})
    await db.venue_loyalty_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": user["id"],
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "points_delta": -reward["cost"],
        "type": "redeem",
        "description": reward["name"],
        "timestamp": now,
    })
    redemption_code = "L-" + uuid.uuid4().hex[:8].upper()
    redemption = {
        "id": str(uuid.uuid4()),
        "code": redemption_code,
        "member_id": user["id"],
        "member_name": user["name"],
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "reward_id": reward["id"],
        "reward_name": reward["name"],
        "reward_description": reward["description"],
        "points_cost": reward["cost"],
        "timestamp": now,
        "redeemed": False,
    }
    await db.venue_redemptions.insert_one(redemption)
    return {
        "redemption": {k: v for k, v in redemption.items() if k != "_id"},
        "balance": balance - reward["cost"],
    }


@api.get("/members/me/loyalty")
async def my_venue_loyalty(user: dict = Depends(get_current_user)):
    accounts = await db.venue_loyalty.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("balance", -1).to_list(200)
    return accounts


@api.get("/members/me/loyalty/redemptions")
async def my_venue_redemptions(user: dict = Depends(get_current_user)):
    items = await db.venue_redemptions.find(
        {"member_id": user["id"]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return items


@api.patch("/staff/venues/{venue_id}/loyalty")
async def update_venue_loyalty_config(
    venue_id: str, payload: LoyaltyConfigIn, user: dict = Depends(require_staff_or_admin)
):
    _assert_staff_can_manage(user, venue_id)
    rewards = []
    for r in payload.rewards:
        rewards.append({
            "id": r.id or str(uuid.uuid4()),
            "name": r.name.strip(),
            "description": r.description.strip(),
            "cost": r.cost,
            "tier_required": r.tier_required,
        })
    updates = {
        "loyalty_points_per_checkin": payload.points_per_checkin,
        "loyalty_points_per_booking": payload.points_per_booking,
        "loyalty_rewards": rewards,
    }
    result = await db.venues.update_one({"id": venue_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"ok": True, **updates}


@api.get("/staff/venues/{venue_id}/loyalty")
async def staff_venue_loyalty(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    members_count = await db.venue_loyalty.count_documents({"venue_id": venue_id})
    issued = await db.venue_loyalty_ledger.aggregate([
        {"$match": {"venue_id": venue_id, "type": "earn"}},
        {"$group": {"_id": None, "total": {"$sum": "$points_delta"}}},
    ]).to_list(1)
    redeemed = await db.venue_loyalty_ledger.aggregate([
        {"$match": {"venue_id": venue_id, "type": "redeem"}},
        {"$group": {"_id": None, "total": {"$sum": "$points_delta"}}},
    ]).to_list(1)
    return {
        "config": public_loyalty_config(venue),
        "members_enrolled": members_count,
        "points_issued": issued[0]["total"] if issued else 0,
        "points_redeemed": -redeemed[0]["total"] if redeemed else 0,
    }


@api.get("/staff/venues/{venue_id}/loyalty/redemptions")
async def staff_venue_loyalty_redemptions(venue_id: str, user: dict = Depends(require_staff_or_admin)):
    _assert_staff_can_manage(user, venue_id)
    items = await db.venue_redemptions.find(
        {"venue_id": venue_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return items


@api.patch("/staff/venues/{venue_id}/loyalty/redemptions/{redemption_id}")
async def update_venue_loyalty_redemption(
    venue_id: str,
    redemption_id: str,
    payload: LoyaltyRedemptionUpdateIn,
    user: dict = Depends(require_staff_or_admin),
):
    _assert_staff_can_manage(user, venue_id)
    result = await db.venue_redemptions.update_one(
        {"id": redemption_id, "venue_id": venue_id},
        {"$set": {"redeemed": payload.redeemed, "redeemed_at": _now_iso() if payload.redeemed else None}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Redemption not found")
    return {"ok": True, "redeemed": payload.redeemed}


# ---------------------------------------------------------------------------
# Reviews — members who have dined at a venue can rate it (one review each)
# ---------------------------------------------------------------------------
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=600)


async def optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def _has_dined(member_id: str, venue_id: str) -> bool:
    if await db.checkins.find_one({"member_id": member_id, "venue_id": venue_id}, {"_id": 1}):
        return True
    seated = await db.bookings.find_one(
        {"member_id": member_id, "venue_id": venue_id, "status": "seated"}, {"_id": 1}
    )
    return seated is not None


async def _rating_summary(venue_id: str) -> dict:
    rows = await db.reviews.find({"venue_id": venue_id}, {"_id": 0, "rating": 1}).to_list(5000)
    count = len(rows)
    avg = round(sum(r["rating"] for r in rows) / count, 1) if count else None
    distribution = {str(n): sum(1 for r in rows if r["rating"] == n) for n in range(1, 6)}
    return {"avg": avg, "count": count, "distribution": distribution}


async def _refresh_venue_rating(venue_id: str) -> dict:
    """Recompute and denormalize onto the venue doc so list endpoints/cards need no join."""
    summary = await _rating_summary(venue_id)
    await db.venues.update_one(
        {"id": venue_id}, {"$set": {"rating_avg": summary["avg"], "rating_count": summary["count"]}}
    )
    return summary


@api.get("/venues/{venue_id}/reviews")
async def list_venue_reviews(venue_id: str, user: Optional[dict] = Depends(optional_user)):
    venue = await resolve_venue(venue_id, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue_id = venue["id"]
    reviews = await db.reviews.find({"venue_id": venue_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    summary = await _rating_summary(venue_id)
    mine = None
    can_review = False
    if user and user.get("role") in ("member", "admin"):
        mine = next((r for r in reviews if r["member_id"] == user["id"]), None)
        can_review = mine is not None or await _has_dined(user["id"], venue_id)
    for r in reviews:
        r["is_mine"] = bool(user and r["member_id"] == user["id"])
        r.pop("member_id", None)
    if mine:
        mine = {k: v for k, v in mine.items() if k != "member_id"}
    return {"summary": summary, "reviews": reviews, "mine": mine, "can_review": can_review}


@api.post("/venues/{venue_id}/reviews")
async def upsert_venue_review(venue_id: str, payload: ReviewIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("member", "admin"):
        raise HTTPException(status_code=403, detail="Only members can leave reviews")
    venue = await resolve_venue(venue_id, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue_id = venue["id"]
    if not await _has_dined(user["id"], venue_id):
        raise HTTPException(status_code=403, detail="Check in or dine here before leaving a review")
    now = _now_iso()
    existing = await db.reviews.find_one({"venue_id": venue_id, "member_id": user["id"]}, {"_id": 0})
    review = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "venue_id": venue_id,
        "member_id": user["id"],
        "member_name": user.get("name") or "Member",
        "rating": payload.rating,
        "text": payload.text.strip(),
        "created_at": existing["created_at"] if existing else now,
        "updated_at": now,
    }
    await db.reviews.replace_one({"venue_id": venue_id, "member_id": user["id"]}, review, upsert=True)
    summary = await _refresh_venue_rating(venue_id)
    review.pop("member_id")
    return {"review": {**review, "is_mine": True}, "summary": summary}


@api.delete("/venues/{venue_id}/reviews/mine")
async def delete_my_review(venue_id: str, user: dict = Depends(get_current_user)):
    venue = await resolve_venue(venue_id, {"_id": 0, "id": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    result = await db.reviews.delete_one({"venue_id": venue["id"], "member_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No review to delete")
    return {"ok": True, "summary": await _refresh_venue_rating(venue["id"])}


# ---------------------------------------------------------------------------
# Include router + CORS
# ---------------------------------------------------------------------------
app.include_router(api)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data on startup
# ---------------------------------------------------------------------------
SEED_VENUES = [
    {
        "id": "venue-verre",
        "name": "Verre",
        "type": "Restaurant",
        "cuisine": "French Bistro",
        "price_level": 3,
        "neighborhood": "West Village",
        "daypart": "night",
        "status": "Filling In",
        "capacity_percent": 65,
        "queue_length": 2,
        "hours": "18:00 – 01:00",
        "tagline": "A bistro that stays until the last conversation.",
        "description": "A candlelit bistro serving natural wine and seasonal small plates. Warm banquettes, patient service, an evening that keeps its own hours.",
        "image_url": "https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Camille Roux",
        "vibes": ["Date Night", "Buzzing"],
        "seed_offerings": [
            {"name": "Beef Tartare", "order_count": 156},
            {"name": "Endive & Roquefort", "order_count": 98},
            {"name": "Steak Frites", "order_count": 142},
            {"name": "Île Flottante", "order_count": 67},
        ],
        "featured": True,
    },
    {
        "id": "venue-osteria",
        "name": "Osteria Verde",
        "type": "Restaurant",
        "cuisine": "Italian",
        "price_level": 3,
        "neighborhood": "Marais",
        "daypart": "night",
        "status": "At Capacity",
        "capacity_percent": 92,
        "queue_length": 7,
        "hours": "18:00 – 23:30",
        "tagline": "Long tables. Longer conversations.",
        "description": "A generous Italian trattoria with a single wood-fired oven, house-made pasta, and a wine list that walks you from Piedmont to Sicily.",
        "image_url": "https://images.unsplash.com/photo-1551218808-94e220e084d2?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Enzo Marchetti",
        "vibes": ["Chef's Pick", "Group-Friendly"],
        "seed_offerings": [
            {"name": "Cacio e Pepe", "order_count": 218},
            {"name": "Bistecca alla Fiorentina", "order_count": 176},
            {"name": "Burrata & Peach", "order_count": 132},
            {"name": "Tiramisu", "order_count": 104},
        ],
        "featured": True,
    },
    {
        "id": "venue-ikigai",
        "name": "Ikigai",
        "type": "Restaurant",
        "cuisine": "Japanese Omakase",
        "price_level": 4,
        "neighborhood": "Downtown",
        "daypart": "night",
        "status": "Quiet",
        "capacity_percent": 35,
        "queue_length": 0,
        "hours": "18:00 – 23:00",
        "tagline": "Twelve seats. One evening.",
        "description": "An intimate omakase counter with two seatings a night. The chef speaks little and pours patiently — you leave when the last course is finished.",
        "image_url": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Kenji Watanabe",
        "vibes": ["Chef's Pick"],
        "seed_offerings": [
            {"name": "Otoro Nigiri", "order_count": 189},
            {"name": "Uni & Ikura", "order_count": 143},
            {"name": "Wagyu Course", "order_count": 96},
            {"name": "Yuzu Sorbet", "order_count": 61},
        ],
        "featured": True,
    },
    {
        "id": "venue-salle-privee",
        "name": "Salle Privée",
        "type": "Restaurant",
        "cuisine": "Chef's Counter",
        "price_level": 4,
        "neighborhood": "Financial District",
        "daypart": "night",
        "status": "Filling In",
        "capacity_percent": 70,
        "queue_length": 3,
        "hours": "19:00 – 23:30",
        "tagline": "A single seating each night.",
        "description": "A private counter of ten seats served a nightly tasting menu by the chef. Silverware only, house pianist optional, seasons observed.",
        "image_url": "https://images.unsplash.com/photo-1643101570532-88c8ecc07c1f?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Marion Aubert",
        "vibes": ["Insider Access", "Chef's Pick"],
        "seed_offerings": [
            {"name": "Chef's Tasting", "order_count": 92},
            {"name": "Caviar Service", "order_count": 61},
            {"name": "Duck Ballotine", "order_count": 78},
            {"name": "Grand Cru Pour", "order_count": 55},
        ],
        "featured": False,
    },
    {
        "id": "venue-la-petite",
        "name": "La Petite",
        "type": "Restaurant",
        "cuisine": "Small Plates",
        "price_level": 2,
        "neighborhood": "Belleville",
        "daypart": "night",
        "status": "Quiet",
        "capacity_percent": 45,
        "queue_length": 0,
        "hours": "17:30 – 23:00",
        "tagline": "Small plates, unhurried nights.",
        "description": "A neighborhood bistro that serves a rotating menu of small plates until the last table is happy. Solo seats at the pass, natural wine by the glass.",
        "image_url": "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Sofia Duval",
        "vibes": ["Solo-Friendly", "Neighborhood Favorite"],
        "seed_offerings": [
            {"name": "Comté Gougères", "order_count": 118},
            {"name": "Duck Rillettes", "order_count": 94},
            {"name": "Roast Chicken for Two", "order_count": 132},
            {"name": "Poached Pear", "order_count": 47},
        ],
        "featured": False,
    },
    {
        "id": "venue-chambre",
        "name": "Chambre",
        "type": "Restaurant",
        "cuisine": "Modern American",
        "price_level": 4,
        "neighborhood": "Mayfair",
        "daypart": "night",
        "status": "Filling In",
        "capacity_percent": 60,
        "queue_length": 1,
        "hours": "18:00 – 00:00",
        "tagline": "New American, quietly ambitious.",
        "description": "A first-year dining room turning heads for its quiet plating and slow-cooked room. Green banquettes, a single piano, a bar that pours off-menu.",
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?crop=entropy&cs=srgb&fm=jpg&q=85",
        "chef": "Everett Blake",
        "vibes": ["Date Night", "Just Opened"],
        "seed_offerings": [
            {"name": "Aged Ribeye", "order_count": 137},
            {"name": "Halibut with Kelp Butter", "order_count": 112},
            {"name": "Sunchoke Velouté", "order_count": 84},
            {"name": "Buttermilk Ice", "order_count": 63},
        ],
        "featured": False,
    },
]

def _seed_event_date(days_ahead: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


SEED_EVENTS = [
    {
        "venue_id": "venue-verre",
        "title": "Natural Wine Table",
        "description": "A guided five-glass flight from the Loire, poured tableside.",
        "date": _seed_event_date(1),
        "time": "20:30",
        "tier_required": None,
        "capacity": 24,
    },
    {
        "venue_id": "venue-osteria",
        "title": "Pasta Sunday",
        "description": "Six house-made shapes, one long table, all evening.",
        "date": _seed_event_date(5),
        "time": "19:00",
        "tier_required": None,
        "capacity": 40,
    },
    {
        "venue_id": "venue-ikigai",
        "title": "A Winter Course",
        "description": "A twelve-course omakase built around Hokkaido winter fish.",
        "date": _seed_event_date(12),
        "time": "19:30",
        "tier_required": "Inner Circle",
        "capacity": 12,
    },
    {
        "venue_id": "venue-salle-privee",
        "title": "The March Tasting",
        "description": "A five-course seasonal menu, silverware only.",
        "date": _seed_event_date(8),
        "time": "20:00",
        "tier_required": "Insider",
        "capacity": 20,
    },
    {
        "venue_id": "venue-la-petite",
        "title": "Solo Counter Night",
        "description": "Ten seats reserved for solo diners at the chef’s pass.",
        "date": _seed_event_date(3),
        "time": "19:00",
        "tier_required": None,
        "capacity": 10,
    },
    {
        "venue_id": "venue-chambre",
        "title": "Piano After Dinner",
        "description": "A late-service pianist and off-menu pours until close.",
        "date": _seed_event_date(10),
        "time": "22:00",
        "tier_required": "Inner Circle",
        "capacity": 16,
    },
]


SEED_USERS = [
    # Admin (real user) — gets member data AND can access any staff dashboard
    {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "name": "Yashvee",
        "role": "admin",
        "ritual_points_balance": 1240,
        "lifetime_points": 1650,
        "member_since": "2025-06-12T00:00:00+00:00",
    },
    {
        "email": "alex@ritual.app",
        "password": "ritual2026",
        "name": "Alex Moreau",
        "role": "member",
        "ritual_points_balance": 420,
        "lifetime_points": 580,
        "member_since": "2025-09-04T00:00:00+00:00",
    },
    {
        "email": "mila@ritual.app",
        "password": "ritual2026",
        "name": "Mila Sato",
        "role": "member",
        "ritual_points_balance": 2200,
        "lifetime_points": 3400,
        "member_since": "2024-11-19T00:00:00+00:00",
    },
    {
        "email": "staff.lumen@ritual.app",
        "password": "ritual2026",
        "name": "Ikigai Host",
        "role": "staff",
        "staff_venue_id": "venue-ikigai",
    },
    {
        "email": "staff.verre@ritual.app",
        "password": "ritual2026",
        "name": "Verre Host",
        "role": "staff",
        "staff_venue_id": "venue-verre",
    },
]


async def _reconcile_demo_ledger(member_id: str, target_balance: int) -> None:
    """Idempotently make a demo member's ledger consistent with their seeded balance (see seed_database)."""
    names = {v["id"]: v["name"] for v in SEED_VENUES}

    async def adjust(venue_id: str, delta: int):
        await db.points_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "member_id": member_id,
            "venue_id": venue_id,
            "venue_name": names.get(venue_id, venue_id),
            "points_delta": delta,
            "type": "earn",
            "description": f"Opening balance at {names.get(venue_id, venue_id)}",
            "timestamp": _now_iso(),
        })

    balances = await venue_point_balances(member_id)
    for vid, b in balances.items():
        if b["balance"] < 0 and vid in names:
            await adjust(vid, -b["balance"])
    total = sum(b["balance"] for b in (await venue_point_balances(member_id)).values())
    if total < target_balance:
        await adjust("venue-verre", target_balance - total)
        total = target_balance
    # Points earned since the last restart live in the ledger; keep the stored balance in step with it.
    await db.users.update_one({"id": member_id}, {"$set": {"ritual_points_balance": total}})


# Set SEED_DEMO_DATA=false once real restaurants are loaded (see import_restaurants.py): the six demo
# restaurants, their events, staff logins and demo ledger are then removed/skipped on startup.
SEED_DEMO_DATA = os.environ.get("SEED_DEMO_DATA", "true").lower() != "false"


async def seed_database():
    seed_venues = SEED_VENUES if SEED_DEMO_DATA else []
    # Venues — clear legacy entries that are no longer in the seed list (e.g. Nocturne pre-pivot)
    seed_ids = [v["id"] for v in seed_venues]
    # Venues restaurants registered themselves or an admin added must survive restarts.
    await db.venues.delete_many({"id": {"$nin": seed_ids}, "source": {"$nin": ["registered", "admin"]}})
    for v in seed_venues:
        existing = await db.venues.find_one({"id": v["id"]})
        doc = {
            **v,
            "signature_offerings": list(v["seed_offerings"]),
            "published": True,
            "availability": "accepting",
            "wait_minutes": None,
            "last_status_update": _now_iso(),
            "regulars_order": [o["name"] for o in v["seed_offerings"][:4]],
        }
        if existing:
            # Preserve status if manually set — but on cold start, refresh
            await db.venues.update_one({"id": v["id"]}, {"$set": doc})
        else:
            doc["loyalty_points_per_checkin"] = 50
            doc["loyalty_points_per_booking"] = 30
            doc["loyalty_rewards"] = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Free Dessert",
                    "description": "A sweet finish, on the house.",
                    "cost": 150,
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "10% Off the Table",
                    "description": "A discount on this visit's bill.",
                    "cost": 300,
                },
            ]
            await db.venues.insert_one(doc)

    # Events — only the seeded ones are reset; events staff created are kept
    # (events from before the "seeded" flag existed are matched by their demo venue)
    await db.events.delete_many({"$or": [{"seeded": True}, {"venue_id": {"$in": [v["id"] for v in SEED_VENUES]}}]})
    for e in (SEED_EVENTS if SEED_DEMO_DATA else []):
        await db.events.insert_one({**e, "id": str(uuid.uuid4()), "created_at": _now_iso(), "seeded": True})

    # Users
    for u in SEED_USERS:
        if not SEED_DEMO_DATA and u.get("staff_venue_id"):
            continue  # demo staff logins point at demo restaurants
        email = u["email"].lower()
        existing = await db.users.find_one({"email": email})
        lifetime = u.get("lifetime_points", 0)
        tier = calc_tier(lifetime) if u.get("role") in ("member", "admin") else None
        doc = {
            "id": existing["id"] if existing else str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "ritual_points_balance": u.get("ritual_points_balance", 0),
            "lifetime_points": lifetime,
            "tier": tier,
            "member_since": u.get("member_since", _now_iso()),
            "staff_venue_id": u.get("staff_venue_id"),
            "created_at": existing["created_at"] if existing and "created_at" in existing else _now_iso(),
        }
        if existing:
            await db.users.update_one({"email": email}, {"$set": doc})
        else:
            await db.users.insert_one(doc)

    # A small amount of ledger history for the admin/demo user so wallet isn't empty
    admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if admin and SEED_DEMO_DATA:
        existing_ledger = await db.points_ledger.count_documents({"member_id": admin["id"]})
        if existing_ledger == 0:
            base = datetime.now(timezone.utc) - timedelta(days=20)
            seed_ledger = [
                {"venue": "venue-verre", "delta": 100, "type": "earn", "desc": "Check-in at Verre", "days_ago": 20},
                {"venue": "venue-la-petite", "delta": 100, "type": "earn", "desc": "Check-in at La Petite", "days_ago": 15},
                {"venue": "venue-ikigai", "delta": 100, "type": "earn", "desc": "Check-in at Ikigai", "days_ago": 12},
                {"venue": "venue-osteria", "delta": 100, "type": "earn", "desc": "Check-in at Osteria Verde", "days_ago": 10},
                {"venue": "venue-salle-privee", "delta": -250, "type": "redeem", "desc": "Priority Seating at Salle Privée", "days_ago": 7},
                {"venue": "venue-verre", "delta": 100, "type": "earn", "desc": "Check-in at Verre", "days_ago": 5},
                {"venue": "venue-chambre", "delta": 100, "type": "earn", "desc": "Check-in at Chambre", "days_ago": 3},
            ]
            venue_names = {v["id"]: v["name"] for v in SEED_VENUES}
            for entry in seed_ledger:
                ts = (datetime.now(timezone.utc) - timedelta(days=entry["days_ago"])).isoformat()
                await db.points_ledger.insert_one({
                    "id": str(uuid.uuid4()),
                    "member_id": admin["id"],
                    "venue_id": entry["venue"],
                    "venue_name": venue_names[entry["venue"]],
                    "points_delta": entry["delta"],
                    "type": entry["type"],
                    "description": entry["desc"],
                    "timestamp": ts,
                })

    # Demo accounts get a fixed stored balance on every start; make their ledger add up to it so
    # per-restaurant balances (which come from the ledger) match, and no venue sits below zero.
    for u in (SEED_USERS if SEED_DEMO_DATA else []):
        if u.get("role") in ("member", "admin"):
            member = await db.users.find_one({"email": u["email"].lower()}, {"_id": 0, "id": 1})
            if member:
                await _reconcile_demo_ledger(member["id"], u.get("ritual_points_balance", 0))

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.venues.create_index("id", unique=True)
    await db.venue_payouts.create_index("venue_id", unique=True)
    await db.reviews.create_index([("venue_id", 1), ("member_id", 1)], unique=True)
    await db.events.create_index("venue_id")
    await db.checkins.create_index([("member_id", 1), ("timestamp", -1)])
    await db.points_ledger.create_index([("member_id", 1), ("timestamp", -1)])
    await db.redemptions.create_index([("member_id", 1), ("timestamp", -1)])
    await db.venue_loyalty.create_index([("member_id", 1), ("venue_id", 1)], unique=True)
    await db.venue_loyalty_ledger.create_index([("member_id", 1), ("venue_id", 1), ("timestamp", -1)])
    await db.venue_redemptions.create_index([("member_id", 1), ("timestamp", -1)])
    await db.venue_redemptions.create_index([("venue_id", 1), ("timestamp", -1)])


@app.on_event("startup")
async def on_startup():
    await seed_database()
    logger.info("Table API ready. Seed complete.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "table", "status": "ok"}
