from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import hmac
import hashlib
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr


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

PERKS = [
    {
        "code": "priority",
        "name": "Priority Seating",
        "cost": 250,
        "description": "Skip the wait. A table opens for you on arrival.",
        "tier_required": "Guest",
    },
    {
        "code": "complimentary",
        "name": "Complimentary Signature",
        "cost": 500,
        "description": "A signature offering, from the house.",
        "tier_required": "Regular",
    },
    {
        "code": "early_access",
        "name": "Early Access Booking",
        "cost": 750,
        "description": "Reserve before the room opens to the public.",
        "tier_required": "Regular",
    },
    {
        "code": "inner_experience",
        "name": "Inner Circle Experience",
        "cost": 1000,
        "description": "A curated tasting, chef's counter, or off-menu pour.",
        "tier_required": "Insider",
    },
]


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


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CheckInIn(BaseModel):
    item_ordered: Optional[str] = None
    would_return: Optional[bool] = None


class RedeemIn(BaseModel):
    venue_id: str
    perk_code: str


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


class QrSlugIn(BaseModel):
    qr_slug: str = Field(min_length=3, max_length=40, pattern=r"^[a-z0-9-]+$")


class EventIn(BaseModel):
    title: str
    description: str
    date: str  # ISO date
    time: str  # e.g. "21:00"
    tier_required: Optional[Literal["Guest", "Regular", "Insider", "Inner Circle"]] = None


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
    description: str = Field(min_length=1, max_length=280)
    cost: int = Field(ge=1, le=100000)


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
    """Credit venue-specific loyalty points. These are separate from the
    cross-venue Table Points balance and can only be redeemed at this venue."""
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
@api.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
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
        "ledger": ledger,
    }


@api.get("/perks")
async def list_perks():
    return PERKS


@api.post("/wallet/redeem")
async def redeem(payload: RedeemIn, user: dict = Depends(get_current_user)):
    perk = next((p for p in PERKS if p["code"] == payload.perk_code), None)
    if not perk:
        raise HTTPException(status_code=404, detail="Perk not found")
    venue = await db.venues.find_one({"id": payload.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    # Tier gate — checked BEFORE balance so a tier violation reads clearly
    user_tier_idx = TIER_ORDER.index(user.get("tier", "Guest"))
    perk_tier_idx = TIER_ORDER.index(perk["tier_required"])
    if user_tier_idx < perk_tier_idx:
        raise HTTPException(
            status_code=403,
            detail=f"This perk is reserved for {perk['tier_required']} and above",
        )

    balance = user.get("ritual_points_balance", 0)
    if balance < perk["cost"]:
        raise HTTPException(status_code=400, detail="Not enough Table Points")

    now = _now_iso()
    new_balance = balance - perk["cost"]
    redemption_code = "R-" + uuid.uuid4().hex[:8].upper()
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"ritual_points_balance": new_balance}}
    )
    await db.points_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": user["id"],
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "points_delta": -perk["cost"],
        "type": "redeem",
        "description": f"{perk['name']} at {venue['name']}",
        "timestamp": now,
    })
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


def _generate_slots(hours: str) -> list:
    """Parse '18:00 – 23:00' or '18:00 – 01:00' into 30-min slots.
    Last slot is 30 min before close so a party has time to sit.
    """
    if not hours:
        return []
    try:
        normalized = hours.replace("—", "-").replace("–", "-")
        parts = [p.strip() for p in normalized.split("-")]
        if len(parts) != 2:
            return []
        sh, sm = map(int, parts[0].split(":"))
        eh, em = map(int, parts[1].split(":"))
        if eh < sh:  # crosses midnight, e.g. 18:00–01:00
            eh += 24
        cur = sh * 60 + sm
        end_min = eh * 60 + em
        slots = []
        while cur + 30 <= end_min:
            h = (cur // 60) % 24
            m = cur % 60
            slots.append(f"{h:02d}:{m:02d}")
            cur += 30
        return slots
    except Exception:
        return []


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
        {
            "venue_id": venue_id,
            "date": date,
            "status": {"$in": ["pending", "confirmed"]},
        },
        {"_id": 0, "time": 1},
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
    taken = await db.bookings.count_documents({
        "venue_id": payload.venue_id,
        "date": payload.date,
        "time": payload.time,
        "status": {"$in": ["pending", "confirmed"]},
    })
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
        {"$set": {"redeemed": payload.redeemed}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Redemption not found")
    return {"ok": True, "redeemed": payload.redeemed}


# ---------------------------------------------------------------------------
# Include router + CORS
# ---------------------------------------------------------------------------
app.include_router(api)

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

SEED_EVENTS = [
    {
        "venue_id": "venue-verre",
        "title": "Natural Wine Table",
        "description": "A guided five-glass flight from the Loire, poured tableside.",
        "date": "2026-02-27",
        "time": "20:30",
        "tier_required": None,
    },
    {
        "venue_id": "venue-osteria",
        "title": "Pasta Sunday",
        "description": "Six house-made shapes, one long table, all evening.",
        "date": "2026-03-01",
        "time": "19:00",
        "tier_required": None,
    },
    {
        "venue_id": "venue-ikigai",
        "title": "A Winter Course",
        "description": "A twelve-course omakase built around Hokkaido winter fish.",
        "date": "2026-03-14",
        "time": "19:30",
        "tier_required": "Inner Circle",
    },
    {
        "venue_id": "venue-salle-privee",
        "title": "The March Tasting",
        "description": "A five-course seasonal menu, silverware only.",
        "date": "2026-03-08",
        "time": "20:00",
        "tier_required": "Insider",
    },
    {
        "venue_id": "venue-la-petite",
        "title": "Solo Counter Night",
        "description": "Ten seats reserved for solo diners at the chef’s pass.",
        "date": "2026-02-24",
        "time": "19:00",
        "tier_required": None,
    },
    {
        "venue_id": "venue-chambre",
        "title": "Piano After Dinner",
        "description": "A late-service pianist and off-menu pours until close.",
        "date": "2026-03-10",
        "time": "22:00",
        "tier_required": "Inner Circle",
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


async def seed_database():
    # Venues — clear legacy entries that are no longer in SEED_VENUES (e.g. Nocturne pre-pivot)
    seed_ids = [v["id"] for v in SEED_VENUES]
    await db.venues.delete_many({"id": {"$nin": seed_ids}})
    for v in SEED_VENUES:
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

    # Events
    await db.events.delete_many({})
    for e in SEED_EVENTS:
        await db.events.insert_one({**e, "id": str(uuid.uuid4()), "created_at": _now_iso()})

    # Users
    for u in SEED_USERS:
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
    if admin:
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

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.venues.create_index("id", unique=True)
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
