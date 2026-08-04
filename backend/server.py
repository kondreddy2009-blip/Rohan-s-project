from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
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

app = FastAPI(title="Ritual API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ritual")


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
    query: dict = {}
    if daypart and daypart.lower() in ("day", "night"):
        query["daypart"] = {"$in": [daypart.lower(), "both"]}
    venues = await db.venues.find(query, {"_id": 0, "seed_offerings": 0}).to_list(200)
    # Custom sort: featured first, then name
    venues.sort(key=lambda v: (not v.get("featured", False), v["name"]))
    return venues


@api.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "seed_offerings": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    events = await db.events.find({"venue_id": venue_id}, {"_id": 0}).to_list(50)
    events.sort(key=lambda e: (e["date"], e["time"]))
    venue["events"] = events
    return venue


@api.post("/venues/{venue_id}/checkin")
async def checkin(venue_id: str, payload: CheckInIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("member", "admin"):
        raise HTTPException(status_code=403, detail="Only members can check in")
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

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

    return {
        "checkin_id": checkin_id,
        "points_earned": delta,
        "balance": new_balance,
        "lifetime_points": new_lifetime,
        "tier": new_tier,
        "venue_name": venue["name"],
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
        raise HTTPException(status_code=400, detail="Not enough Ritual Points")

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
    updates: dict = {"status": payload.status}
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
        "id": "venue-aureus",
        "name": "Aureus",
        "type": "Cafe",
        "neighborhood": "Marais",
        "daypart": "day",
        "status": "Quiet",
        "capacity_percent": 30,
        "hours": "07:00 – 16:00",
        "tagline": "A quiet morning ritual.",
        "description": "A slow-pour specialty coffee bar tucked behind a bookshop courtyard. Marble counters, morning light, single-origin only.",
        "image_url": "https://images.pexels.com/photos/34041969/pexels-photo-34041969.jpeg",
        "seed_offerings": [
            {"name": "Kyoto Cold Brew", "order_count": 84},
            {"name": "Cardamom Latte", "order_count": 71},
            {"name": "Miel & Butter Toast", "order_count": 62},
            {"name": "Almond Croissant", "order_count": 48},
        ],
        "featured": True,
    },
    {
        "id": "venue-verre",
        "name": "Verre",
        "type": "Dining",
        "neighborhood": "West Village",
        "daypart": "both",
        "status": "Filling In",
        "capacity_percent": 65,
        "hours": "12:00 – 23:00",
        "tagline": "A bistro that stays until the last conversation.",
        "description": "A candlelit bistro serving natural wine and seasonal small plates. The same room, an entirely different mood after dark.",
        "image_url": "https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHw0fHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85",
        "seed_offerings": [
            {"name": "Beef Tartare", "order_count": 156},
            {"name": "Endive & Roquefort", "order_count": 98},
            {"name": "Steak Frites", "order_count": 142},
            {"name": "Île Flottante", "order_count": 67},
        ],
        "featured": True,
    },
    {
        "id": "venue-lumen",
        "name": "Lumen",
        "type": "Lounge",
        "neighborhood": "Downtown",
        "daypart": "night",
        "status": "Quiet",
        "capacity_percent": 40,
        "hours": "17:00 – 02:00",
        "tagline": "A rooftop, above the noise.",
        "description": "A rooftop cocktail lounge overlooking the skyline. Amber lighting, brass fittings, a bar list that reads like a poem.",
        "image_url": "https://images.unsplash.com/photo-1575444758702-4a6b9222336e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwyfHxsb3clMjBsaWdodCUyMGNvY2t0YWlsJTIwYmFyfGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85",
        "seed_offerings": [
            {"name": "Smoked Old Fashioned", "order_count": 203},
            {"name": "Yuzu Gimlet", "order_count": 178},
            {"name": "Vesper", "order_count": 121},
            {"name": "Negroni Bianco", "order_count": 96},
        ],
        "featured": True,
    },
    {
        "id": "venue-noctis",
        "name": "Noctis",
        "type": "Bar",
        "neighborhood": "Chinatown",
        "daypart": "night",
        "status": "At Capacity",
        "capacity_percent": 95,
        "hours": "21:00 – 04:00",
        "tagline": "The last room before morning.",
        "description": "A late-night listening bar hidden behind an unmarked door. Vinyl only, low ceilings, quiet crowds.",
        "image_url": "https://images.unsplash.com/photo-1597075687490-8f673c6c17f6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwzfHxsb3clMjBsaWdodCUyMGNvY2t0YWlsJTIwYmFyfGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85",
        "seed_offerings": [
            {"name": "Highball Reserve", "order_count": 189},
            {"name": "Mezcal Sazerac", "order_count": 143},
            {"name": "Champagne Coupe", "order_count": 87},
        ],
        "featured": False,
    },
    {
        "id": "venue-salle-privee",
        "name": "Salle Privée",
        "type": "Club",
        "neighborhood": "Financial District",
        "daypart": "night",
        "status": "Filling In",
        "capacity_percent": 70,
        "hours": "20:00 – 03:00",
        "tagline": "A supper club that keeps its own hours.",
        "description": "A members-first supper club with a tasting menu, a house pianist, and a single seating each night.",
        "image_url": "https://images.unsplash.com/photo-1643101570532-88c8ecc07c1f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwyfHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85",
        "seed_offerings": [
            {"name": "Chef's Tasting", "order_count": 92},
            {"name": "Caviar Service", "order_count": 61},
            {"name": "Duck Ballotine", "order_count": 78},
            {"name": "Grand Cru Pour", "order_count": 55},
        ],
        "featured": False,
    },
    {
        "id": "venue-miel",
        "name": "Pâtisserie Miel",
        "type": "Cafe",
        "neighborhood": "Upper East",
        "daypart": "day",
        "status": "Filling In",
        "capacity_percent": 55,
        "hours": "08:00 – 19:00",
        "tagline": "Small pastries, considered.",
        "description": "A tiny pâtisserie run by a former three-star pastry chef. Six items daily, always finished by four.",
        "image_url": "https://images.unsplash.com/photo-1564844536308-50b114a1d946?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHw0fHxjaGVmJTIwcGxhdGV8ZW58MHx8fHwxNzgzNTkyMzE2fDA&ixlib=rb-4.1.0&q=85",
        "seed_offerings": [
            {"name": "Paris-Brest", "order_count": 134},
            {"name": "Canelé", "order_count": 118},
            {"name": "Honey Tart", "order_count": 89},
            {"name": "Passionfruit Éclair", "order_count": 76},
        ],
        "featured": False,
    },
]

SEED_EVENTS = [
    {
        "venue_id": "venue-lumen",
        "title": "An Evening with Isolde Marsh",
        "description": "A private set from the London-based pianist. Reservations by request.",
        "date": "2026-03-14",
        "time": "21:00",
        "tier_required": "Inner Circle",
    },
    {
        "venue_id": "venue-verre",
        "title": "Natural Wine Table",
        "description": "A guided five-glass flight from the Loire, poured tableside.",
        "date": "2026-02-27",
        "time": "19:30",
        "tier_required": None,
    },
    {
        "venue_id": "venue-aureus",
        "title": "Single-Origin Sunday",
        "description": "A rotating pour-over showcase with the roaster in attendance.",
        "date": "2026-03-01",
        "time": "10:00",
        "tier_required": None,
    },
    {
        "venue_id": "venue-salle-privee",
        "title": "The March Tasting",
        "description": "A five-course seasonal menu, silverware only.",
        "date": "2026-03-08",
        "time": "20:30",
        "tier_required": "Insider",
    },
    {
        "venue_id": "venue-noctis",
        "title": "Late Hours: Vinyl Only",
        "description": "A guest selector spins soul and jazz until four.",
        "date": "2026-02-22",
        "time": "23:00",
        "tier_required": None,
    },
    {
        "venue_id": "venue-miel",
        "title": "The Honey Course",
        "description": "A pâtisserie course paired with a single-varietal honey tasting.",
        "date": "2026-03-05",
        "time": "16:00",
        "tier_required": "Regular",
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
        "name": "Lumen Front Desk",
        "role": "staff",
        "staff_venue_id": "venue-lumen",
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
    # Venues
    for v in SEED_VENUES:
        existing = await db.venues.find_one({"id": v["id"]})
        doc = {**v, "signature_offerings": list(v["seed_offerings"])}
        if existing:
            # Preserve status if manually set — but on cold start, refresh
            await db.venues.update_one({"id": v["id"]}, {"$set": doc})
        else:
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
                {"venue": "venue-aureus", "delta": 100, "type": "earn", "desc": "Check-in at Aureus", "days_ago": 20},
                {"venue": "venue-verre", "delta": 100, "type": "earn", "desc": "Check-in at Verre", "days_ago": 15},
                {"venue": "venue-lumen", "delta": 100, "type": "earn", "desc": "Check-in at Lumen", "days_ago": 12},
                {"venue": "venue-miel", "delta": 100, "type": "earn", "desc": "Check-in at Pâtisserie Miel", "days_ago": 10},
                {"venue": "venue-salle-privee", "delta": -250, "type": "redeem", "desc": "Priority Seating at Salle Privée", "days_ago": 7},
                {"venue": "venue-verre", "delta": 100, "type": "earn", "desc": "Check-in at Verre", "days_ago": 5},
                {"venue": "venue-lumen", "delta": 100, "type": "earn", "desc": "Check-in at Lumen", "days_ago": 3},
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


@app.on_event("startup")
async def on_startup():
    await seed_database()
    logger.info("Ritual API ready. Seed complete.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "ritual", "status": "ok"}
