"""Load real restaurants (details, photos, menus, staff logins) into the database.

    cd backend && .venv/bin/python import_restaurants.py                      # imports data/restaurants/restaurants.json
    .venv/bin/python import_restaurants.py path/to/other.json --dry-run       # validate only

Re-running is safe: restaurants are matched by `slug` and updated in place (their photos are replaced
with the ones listed in the file; loyalty settings, reviews and bookings are left alone).
Photo paths in the JSON are relative to the JSON file. See data/restaurants/restaurants.template.json.
"""
import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

from pydantic import ValidationError

import server
from server import MenuIn, PHOTO_CATEGORIES, UPLOAD_DIR, _now_iso, _process_photo, build_menu, db, hash_password

REQUIRED = ("name", "slug", "cuisine", "price_level", "neighborhood", "hours", "tagline", "description")


def load(path: Path) -> list:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["restaurants"] if isinstance(data, dict) else data


def validate(r: dict, base: Path) -> list:
    errs = [f"missing '{k}'" for k in REQUIRED if not r.get(k)]
    if r.get("price_level") not in (1, 2, 3, 4):
        errs.append("price_level must be 1-4")
    if r.get("slug") and not all(c.isalnum() or c == "-" for c in r["slug"]):
        errs.append("slug may only contain letters, digits and '-'")
    files = [r.get("cover_photo")] + [p.get("file") for p in r.get("photos", [])]
    for f in files:
        if f and not (base / f).is_file():
            errs.append(f"photo not found: {f}")
    for p in r.get("photos", []):
        if p.get("category") not in PHOTO_CATEGORIES:
            errs.append(f"photo {p.get('file')}: category must be one of {PHOTO_CATEGORIES}")
    if not r.get("cover_photo"):
        errs.append("missing 'cover_photo'")
    try:
        MenuIn(sections=r.get("menu", []))
    except ValidationError as e:
        errs.append(f"menu: {e.errors()[0]['loc']} {e.errors()[0]['msg']}")
    st = r.get("staff")
    if st and not (st.get("email") and st.get("password")):
        errs.append("staff needs email and password")
    return errs


def store_photo(venue_id: str, path: Path, name: str) -> dict:
    full, thumb = _process_photo(path.read_bytes())
    vdir = UPLOAD_DIR / venue_id
    vdir.mkdir(parents=True, exist_ok=True)
    pid = str(uuid.uuid4())
    if thumb is None:
        full_name, thumb_name = f"{pid}.gif", f"{pid}.gif"
    else:
        full_name, thumb_name = f"{pid}.webp", f"{pid}_t.webp"
        (vdir / thumb_name).write_bytes(thumb)
    (vdir / full_name).write_bytes(full)
    return {"id": pid, "url": f"/api/uploads/{venue_id}/{full_name}", "thumb_url": f"/api/uploads/{venue_id}/{thumb_name}"}


async def import_one(r: dict, base: Path) -> str:
    venue_id = f"venue-{r['slug']}"
    existing = await db.venues.find_one({"id": venue_id}, {"_id": 0, "photos": 1, "image_url": 1})
    # Replace, don't pile up, on re-import: drop the previous cover and gallery files.
    old_urls = [p.get(k) for p in (existing or {}).get("photos", []) for k in ("url", "thumb_url")]
    old_urls.append((existing or {}).get("image_url"))
    for u in old_urls:
        if u and u.startswith(f"/api/uploads/{venue_id}/"):
            (UPLOAD_DIR / venue_id / Path(u).name).unlink(missing_ok=True)
    cover = store_photo(venue_id, base / r["cover_photo"], "cover")
    photos = [
        {**store_photo(venue_id, base / p["file"], p["file"]), "category": p["category"], "caption": p.get("caption", ""), "uploaded_at": _now_iso()}
        for p in r.get("photos", [])
    ]
    menu = build_menu(MenuIn(sections=r.get("menu", [])))
    fields = {
        "id": venue_id,
        "name": r["name"],
        "type": "Restaurant",
        "cuisine": r["cuisine"],
        "price_level": r["price_level"],
        "neighborhood": r["neighborhood"],
        "hours": r["hours"],
        "tagline": r["tagline"],
        "description": r["description"],
        "image_url": cover["url"],
        "chef": r.get("chef"),
        "vibes": r.get("vibes", []),
        "daypart": r.get("daypart", "both"),
        "featured": bool(r.get("featured", False)),
        "photos": photos,
        "menu": menu,
        "regulars_order": r.get("regulars_order") or [i["name"] for s in menu for i in s["items"]][:4],
        "source": "registered",  # survives restarts
        "published": True,
    }
    if existing is None:
        defaults = {
            "status": "Quiet", "capacity_percent": 25, "queue_length": 0, "availability": "accepting",
            "wait_minutes": None, "last_status_update": _now_iso(), "seed_offerings": [], "signature_offerings": [],
            "loyalty_points_per_checkin": r.get("loyalty_points_per_checkin", 50),
            "loyalty_points_per_booking": r.get("loyalty_points_per_booking", 30),
            "loyalty_rewards": r.get("loyalty_rewards") or [],
            "created_at": _now_iso(),
        }
        await db.venues.insert_one({**defaults, **fields})
    else:
        await db.venues.update_one({"id": venue_id}, {"$set": fields})

    st = r.get("staff")
    if st:
        email = st["email"].lower()
        user = await db.users.find_one({"email": email})
        doc = {"name": st.get("name") or f"{r['name']} Host", "role": "staff", "staff_venue_id": venue_id, "password_hash": hash_password(st["password"])}
        if user:
            await db.users.update_one({"email": email}, {"$set": doc})
        else:
            await db.users.insert_one({**doc, "id": str(uuid.uuid4()), "email": email, "created_at": _now_iso()})
    items = sum(len(s["items"]) for s in menu)
    return f"{r['name']}: {len(photos) + 1} photos, {len(menu)} menu sections / {items} dishes" + (f", staff login {st['email']}" if st else "")


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default=str(Path(__file__).parent / "data/restaurants/restaurants.json"))
    ap.add_argument("--dry-run", action="store_true", help="validate the file and photos without writing anything")
    args = ap.parse_args()
    path = Path(args.file).resolve()
    restaurants = load(path)
    bad = False
    for r in restaurants:
        errs = validate(r, path.parent)
        for e in errs:
            print(f"  ✗ {r.get('name', '?')}: {e}")
        bad = bad or bool(errs)
    if bad:
        print("Fix the problems above and run again. Nothing was imported.")
        return 1
    if args.dry_run:
        print(f"OK — {len(restaurants)} restaurant(s) valid. (dry run, nothing written)")
        return 0
    for r in restaurants:
        print("  ✓", await import_one(r, path.parent))
    print("\nDone. To drop the six demo restaurants, set SEED_DEMO_DATA=false in backend/.env and restart the backend.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
