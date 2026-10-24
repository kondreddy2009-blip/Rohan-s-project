import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, X, ChevronDown, ChevronLeft, ChevronRight, ArrowRight, CalendarDays,
  MapPin, UtensilsCrossed, Star, Flame, Crown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FillingFastCard, fillingFastStatus } from "@/components/FillingFastCard";
import { EventCard } from "@/components/EventCard";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandLockup } from "@/components/BrandLockup";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/lib/usePageTitle";
import { cn } from "@/lib/utils";

const TIER_THRESHOLDS = { Guest: 0, Regular: 500, Insider: 1500, "Inner Circle": 3000 };

const isWalkIn = (v) =>
  v.availability !== "fully_booked" && v.status !== "At Capacity" && !(v.wait_minutes > 0);

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "walk-in", label: "Walk-in now", match: isWalkIn },
  { key: "under-800", label: "Under ₹800", match: (v) => (v.price_level || 3) <= 2 },
  { key: "2x", label: "2x points", match: (v) => (v.loyalty_points_per_checkin || 0) >= 10 },
];

const SORTS = [
  { key: "recommended", label: "Recommended", cmp: () => 0 },
  { key: "rating", label: "Top rated", cmp: (a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0) },
  { key: "wait", label: "Shortest wait", cmp: (a, b) => waitRank(a) - waitRank(b) },
  { key: "price-asc", label: "Price: low to high", cmp: (a, b) => (a.price_level || 3) - (b.price_level || 3) },
  { key: "price-desc", label: "Price: high to low", cmp: (a, b) => (b.price_level || 3) - (a.price_level || 3) },
  { key: "name", label: "Name A–Z", cmp: (a, b) => a.name.localeCompare(b.name) },
];

function waitRank(v) {
  if (v.availability === "fully_booked" || v.availability === "closed" || v.status === "At Capacity") return 1e6;
  return v.wait_minutes || 0;
}

const serif = "font-['Cormorant_Garamond']";
const pillBase = "rounded-full border border-white/10 bg-[#141312]/90 backdrop-blur-sm";

const panel = "w-full text-[#F2EDE7] px-5 sm:px-10 lg:px-16 py-8 sm:py-10";
const inner = "mx-auto max-w-[1280px]";

const selectCls =
  "rounded-full border border-white/10 bg-[#141312]/90 backdrop-blur-sm pl-11 pr-10 py-3.5 text-[14px] font-medium text-[#D8CBB9] outline-none focus:border-[#CE6A4A]/60 hover:text-white appearance-none cursor-pointer";

function SelectPill({ className, icon: Icon, children, ...props }) {
  return (
    <div className={cn("relative", className)}>
      {Icon && <Icon strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#CE6A4A]" />}
      <select {...props} className={selectCls}>{children}</select>
      <ChevronDown strokeWidth={2} className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8AA98]" />
    </div>
  );
}

function SearchBar({ query, setQuery, cuisine, setCuisine, cuisines, hood, setHood, hoods, price, setPrice, sort, setSort, filter, setFilter, activeCount, onClear }) {
  return (
    <div className="relative z-10 mt-8 space-y-4" data-testid="discover-search">
      <div className={cn(pillBase, "flex items-center gap-4 px-6 py-1.5 max-w-[930px] border-white/15")}>
        <Search strokeWidth={1.6} className="h-5 w-5 shrink-0 text-[#CE6A4A]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, cuisines, or neighborhoods..."
          aria-label="Search restaurants"
          data-testid="discover-search-input"
          className="min-w-0 flex-1 bg-transparent py-4 text-[16px] text-white outline-none placeholder:text-[#8E8271]"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-[#8F8781] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="hidden sm:block h-8 w-px bg-white/15" />
        <span className="hidden sm:flex items-center gap-2 whitespace-nowrap text-[13px] text-[#D8CBB9]">
          <MapPin strokeWidth={1.6} className="h-4 w-4 text-[#CE6A4A]" /> Current location
          <ChevronDown className="ml-2 h-4 w-4" />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SelectPill icon={UtensilsCrossed} value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label="Cuisine" data-testid="filter-cuisine">
          <option value="">All cuisines</option>
          {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectPill>
        <SelectPill icon={MapPin} value={hood} onChange={(e) => setHood(e.target.value)} aria-label="Neighborhood" data-testid="filter-neighborhood">
          <option value="">All neighborhoods</option>
          {hoods.map((h) => <option key={h} value={h}>{h}</option>)}
        </SelectPill>
        <span className="hidden lg:block h-8 w-px bg-white/10 mx-2" />
        <div className="flex flex-wrap gap-2" role="tablist" data-testid="discover-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              data-testid={`filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-5 py-3.5 text-[14px] font-semibold transition-colors",
                filter === f.key
                  ? "border-[#F5F5F3] bg-[#F5F5F3] text-[#171513]"
                  : "border-white/10 bg-[#141312]/90 text-[#D8CBB9] hover:text-white",
              )}
            >
              {f.label}
              {f.key === "2x" && <Star className="h-3.5 w-3.5 fill-[#E8A33D] text-[#E8A33D]" />}
            </button>
          ))}
        </div>
        <SelectPill value={sort} onChange={(e) => setSort(e.target.value)} className="sm:ml-auto" aria-label="Sort" data-testid="sort-select">
          {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </SelectPill>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} data-testid="clear-filters" className="px-2 py-2 text-[13px] font-bold text-[#EE9B79] hover:text-white">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function Hero({ venues }) {
  const [idx, setIdx] = useState(0);
  if (!venues.length) return null;
  const venue = venues[idx % venues.length];
  const { label, dot } = fillingFastStatus(venue);
  const go = (d) => setIdx((i) => (i + d + venues.length) % venues.length);
  const arrow = "absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 transition-colors";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1B1917]" data-testid={`featured-${venue.id}`}>
      <div className="relative min-h-[420px] sm:min-h-[478px]">
        <img key={venue.id} src={venue.image_url} alt={venue.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
        <span className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-4 py-2 text-sm font-semibold">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          {venue.status === "Quiet" ? `Quiet · ${label.toLowerCase()}` : label}
        </span>
        {venues.length > 1 && (
          <>
            <button type="button" aria-label="Previous" onClick={() => go(-1)} className={cn(arrow, "left-4")}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Next" onClick={() => go(1)} className={cn(arrow, "right-4")}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="absolute inset-y-0 left-[88px] flex max-w-[46%] flex-col justify-center">
          <div className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#CE6A4A]">Featured tonight</div>
          <h2 className="mt-3 text-5xl font-extrabold tracking-tight leading-none">{venue.name}</h2>
          <div className="mt-3 text-[18px] text-white/90">
            {[venue.cuisine, venue.neighborhood].filter(Boolean).join(" · ")}
          </div>
          {venue.tagline && <p className="mt-5 max-w-[320px] text-[15px] leading-relaxed text-white/80">{venue.tagline}</p>}
          <Link
            to={`/venues/${venue.id}`}
            className="mt-7 inline-flex w-fit items-center gap-3 rounded-full bg-[#F2EDE7] px-7 py-3.5 text-[15px] font-bold text-[#0B0A0A] hover:bg-[#F6E3DA] transition-colors"
          >
            View details <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {venues.length > 1 && (
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {venues.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-label={`Show ${v.name}`}
                onClick={() => setIdx(i)}
                className={cn("h-2 rounded-full transition-all", i === idx % venues.length ? "w-6 bg-white" : "w-2 bg-white/40")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

// Falls back to the signed-in user's own fields if /wallet hasn't loaded (or failed).
function tierInfo(wallet, user) {
  if (wallet) return wallet;
  const pts = user?.lifetime_points || 0;
  const tier = user?.tier || "Guest";
  const next = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1] || null;
  const floor = TIER_THRESHOLDS[tier] ?? 0;
  const span = next ? TIER_THRESHOLDS[next] - floor : 1;
  return {
    tier,
    lifetime_points: pts,
    next_tier: next,
    points_to_next: next ? Math.max(0, TIER_THRESHOLDS[next] - pts) : 0,
    progress_percent: next ? Math.min(100, Math.round(((pts - floor) / span) * 100)) : 100,
  };
}

function TierCard({ wallet }) {
  const tier = wallet?.tier || "Guest";
  const pts = wallet?.lifetime_points || 0;
  const partners = wallet?.partners ?? 0;
  return (
    <Link
      to="/wallet"
      className="relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#C9694B] to-[#8A4030] p-6 text-white"
      data-testid="tier-card"
    >
      <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/[0.06]" />
      <div className="relative">
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-white/80">Table tier</div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="text-[40px] font-extrabold tracking-tight leading-tight">{tier}</div>
          <div className="flex items-start gap-4">
            <div className="pt-2 text-right text-[15px] font-semibold leading-snug">
              {pts.toLocaleString("en-IN")} pts
              <br />
              {partners} partner{partners === 1 ? "" : "s"}
            </div>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#0B0A0A]/85">
              <Crown className="h-6 w-6 text-[#EE9B79]" />
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="h-2 flex-1 rounded-full bg-black/35">
            <div className="h-full rounded-full bg-[#EE9B79]" style={{ width: `${wallet?.progress_percent ?? 0}%` }} />
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0B0A0A]/85">
            <ChevronRight className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-1 text-[13px] text-white/75">
          {wallet?.next_tier
            ? `${wallet.points_to_next.toLocaleString("en-IN")} more pts for ${wallet.next_tier}`
            : "You're at the top tier"}
        </div>
      </div>
    </Link>
  );
}

function JoinCard() {
  return (
    <div
      className="rounded-3xl p-6 text-white bg-gradient-to-br from-[#C9694B] to-[#8A4030]"
      data-testid="join-card"
    >
      <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-white/80">Table members</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight leading-tight">Earn at the tables you love. Redeem right there.</div>
      <p className="mt-2 text-sm font-semibold text-white/85">Free to join. Points start from your first check-in.</p>
      <Link
        to="/login"
        state={{ mode: "create" }}
        className="mt-4 inline-block rounded-full bg-[#0B0A0A] px-6 py-3 text-sm font-extrabold text-white hover:bg-black transition-colors"
      >
        Join free
      </Link>
    </div>
  );
}

function Tonight({ venues }) {
  return (
    <div className="flex-1 rounded-3xl border border-white/10 bg-[#141312]/90 p-6" data-testid="tonight-list">
      <div className="flex items-center justify-between">
        <h3 className="text-[20px] font-bold">Tonight across the network</h3>
        <Link to="/events" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#EE9B79] hover:text-white">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="mt-3">
        {venues.slice(0, 3).map((v, i) => {
          const { label, dot } = fillingFastStatus(v);
          const full = label === "Full";
          return (
            <li key={v.id} className={cn(i > 0 && "border-t border-white/[0.08]")}>
              <Link to={`/venues/${v.id}`} className="flex items-center gap-4 py-3">
                <img src={v.image_url} alt="" className="h-12 w-[84px] shrink-0 rounded-lg object-cover ring-1 ring-[#CE6A4A]/30" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-semibold">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                    <span className="truncate">{v.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-[#9C8F7E]">
                    {[v.neighborhood, v.cuisine].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-semibold",
                    full ? "border border-white/10 text-[#F0A58C]" : "bg-[#33302D] text-[#EE9B79]",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Discover() {
  usePageTitle("Discover restaurants");
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [cuisine, setCuisine] = useState("");
  const [hood, setHood] = useState("");
  const [price, setPrice] = useState(0);
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/venues");
        if (!cancelled) setVenues(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    api.get("/events").then(({ data }) => !cancelled && setEvents(data)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.get("/wallet").then(({ data }) => !cancelled && setWallet(data)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const cuisines = useMemo(() => [...new Set(venues.map((v) => v.cuisine).filter(Boolean))].sort(), [venues]);
  const hoods = useMemo(() => [...new Set(venues.map((v) => v.neighborhood).filter(Boolean))].sort(), [venues]);
  const activeCount = [query.trim(), cuisine, hood, price, sort !== "recommended" && sort].filter(Boolean).length;
  const searching = activeCount > 0;
  const clearAll = () => {
    setQuery("");
    setCuisine("");
    setHood("");
    setPrice(0);
    setSort("recommended");
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmp = (SORTS.find((o) => o.key === sort) || SORTS[0]).cmp;
    return venues
      .filter(active.match)
      .filter((v) => !cuisine || v.cuisine === cuisine)
      .filter((v) => !hood || v.neighborhood === hood)
      .filter((v) => !price || (v.price_level || 3) === price)
      .filter(
        (v) =>
          !q ||
          [v.name, v.cuisine, v.neighborhood, v.tagline, ...(v.vibes || [])]
            .filter(Boolean)
            .some((f) => f.toLowerCase().includes(q)),
      )
      .sort(cmp);
  }, [venues, active, query, cuisine, hood, price, sort]);
  const featured = useMemo(
    () => filtered.find((v) => v.featured) || filtered[0],
    [filtered],
  );
  const tonight = useMemo(() => filtered.slice(0, 4), [filtered]);
  const fillingFast = useMemo(() => {
    const urgency = (v) =>
      v.availability === "fully_booked" || v.status === "At Capacity" ? 2 : v.wait_minutes > 0 ? 1 : 0;
    return [...filtered].sort((a, b) => urgency(b) - urgency(a)).slice(0, 4);
  }, [filtered]);

  const partners = useMemo(
    () => new Set((wallet?.ledger || []).map((l) => l.venue_name).filter(Boolean)).size,
    [wallet],
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || "Guest";
  const info = tierInfo(wallet, user);
  const points = info.lifetime_points;
  const pointsAway = (tier) =>
    Math.max(0, (TIER_THRESHOLDS[tier] ?? 0) - info.lifetime_points);

  const heroVenues = useMemo(() => {
    const list = [...filtered];
    const f = list.findIndex((v) => v.featured);
    if (f > 0) list.unshift(...list.splice(f, 1));
    return list.slice(0, 4);
  }, [filtered]);
  const fastRef = useRef(null);
  const scrollFast = (dir) => {
    const el = fastRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0E0D0C] text-[#F2EDE7]" data-testid="discover-page">
      <section className={cn(panel, "relative overflow-hidden")}>
        {/* Ambient backdrop */}
        {heroVenues[0]?.image_url && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] hidden md:block">
            <img src={heroVenues[0].image_url} alt="" className="h-[520px] w-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E0D0C] via-[#0E0D0C]/60 to-[#0E0D0C]/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0E0D0C]/20 to-[#0E0D0C]" style={{ top: 0, height: 560 }} />
          </div>
        )}
        <span className="pointer-events-none absolute right-16 top-44 hidden lg:block -rotate-6 font-['Mrs_Saint_Delafield'] text-[64px] leading-[0.85] text-[#CE6A4A]/90">
          Good<br />&nbsp;Food<br />&nbsp;&nbsp;Better<br />&nbsp;&nbsp;&nbsp;Company
        </span>
        <div className={inner}>
          <SiteHeader points={points} />

          <div className="relative z-10 mt-10">
            <div className="flex items-center gap-2 text-sm text-[#D8CBB9]">
              <span className="h-2 w-2 rounded-full bg-[#7DBE8A]" />
              {venues.length} partners live tonight
            </div>
            <h1 className="mt-4 text-5xl sm:text-[58px] font-extrabold tracking-[-0.03em] leading-tight">
              {user ? (
                <>{greeting}, <span className="text-[#E8B98A]">{firstName}.</span></>
              ) : (
                "Find your next table."
              )}
            </h1>
            <p className="mt-2 text-xl text-[#CDBFAE]">Discover exceptional dining experiences near you.</p>
          </div>

          <SearchBar
            query={query} setQuery={setQuery}
            cuisine={cuisine} setCuisine={setCuisine} cuisines={cuisines}
            hood={hood} setHood={setHood} hoods={hoods}
            price={price} setPrice={setPrice}
            sort={sort} setSort={setSort}
            filter={filter} setFilter={setFilter}
            activeCount={activeCount} onClear={clearAll}
          />

          {loading ? (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-5" aria-busy="true" data-testid="discover-skeleton">
              <Skeleton className="min-h-[420px] sm:min-h-[478px] rounded-3xl bg-white/[0.06]" />
              <div className="flex flex-col gap-5">
                <Skeleton className="h-44 rounded-3xl bg-white/[0.06]" />
                <Skeleton className="flex-1 min-h-[220px] rounded-3xl bg-white/[0.06]" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-16 text-center" data-testid="no-results">
              <div className="text-sm text-[#8F8781]">No restaurants match your search.</div>
              {(searching || filter !== "all") && (
                <button
                  type="button"
                  onClick={() => { clearAll(); setFilter("all"); }}
                  className="mt-4 rounded-full bg-[#23201E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#34281F]"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : searching ? (
            <div data-testid="search-results" className="relative z-10">
              <div className="mt-8 text-sm font-semibold text-[#8F8781]">
                {filtered.length} restaurant{filtered.length === 1 ? "" : "s"}
              </div>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {filtered.map((v) => <FillingFastCard venue={v} key={v.id} />)}
              </div>
            </div>
          ) : (
            <div className="relative z-10 mt-8 grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-5">
              <Hero venues={heroVenues} />
              <div className="flex flex-col gap-5">
                {user ? <TierCard wallet={{ ...info, partners }} /> : <JoinCard />}
                <Tonight venues={tonight} />
              </div>
            </div>
          )}
        </div>
      </section>

      {!loading && !searching && (
        <section className="w-full px-5 sm:px-10 lg:px-16 pb-10" data-testid="filling-fast-section">
          <div className={cn(inner, "border-t border-white/[0.06] pt-10")}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8A27F]">
                  <span className="h-px w-5 bg-[#E8A27F]" /> Popular right now
                </div>
                <h2 className={cn(serif, "mt-2 flex items-center gap-3 text-[52px] font-medium leading-none text-white")}>
                  Filling in fast <Flame className="h-9 w-9 fill-[#F07F5E]/20 text-[#F07F5E]" />
                </h2>
                <p className="mt-3 text-[16px] text-[#CDBFAE]">These restaurants are getting booked quickly. Don’t miss out!</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSort("wait")}
                  className="flex items-center gap-2 rounded-full border border-[#E8A27F]/60 px-6 py-3 text-sm font-semibold text-[#EE9B79] hover:bg-white/[0.04]"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </button>
                {["Previous", "Next"].map((l, i) => (
                  <button
                    key={l}
                    type="button"
                    aria-label={l}
                    onClick={() => scrollFast(i ? 1 : -1)}
                    className="grid h-12 w-12 place-items-center rounded-full border border-[#E8A27F]/60 text-[#EE9B79] hover:bg-white/[0.04]"
                  >
                    {i ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                ))}
              </div>
            </div>
            <div ref={fastRef} className="mt-7 flex gap-4 overflow-x-auto snap-x pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {fillingFast.map((v) => (
                <div key={v.id} className="snap-start shrink-0 w-[78%] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]">
                  <FillingFastCard venue={v} />
                </div>
              ))}
            </div>

            {events.length > 0 && (
              <div className="mt-14 border-t border-white/[0.06] pt-10" data-testid="events-section">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8A27F]">
                      <span className="h-px w-5 bg-[#E8A27F]" /> Special experiences
                    </div>
                    <h2 className={cn(serif, "mt-2 flex items-center gap-3 text-[52px] font-medium leading-none text-white")}>
                      Events <CalendarDays strokeWidth={1.4} className="h-9 w-9 text-[#E8A27F]" />
                    </h2>
                    <p className="mt-3 text-[16px] text-[#CDBFAE]">What your tier opens, across every partner.</p>
                  </div>
                  <Link
                    to="/events"
                    className="flex items-center gap-2 rounded-full border border-[#E8A27F]/60 px-6 py-3 text-sm font-semibold text-[#EE9B79] hover:bg-white/[0.04]"
                  >
                    View all events <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.slice(0, 3).map((e) => (
                    <EventCard
                      event={e}
                      userTier={info.tier}
                      pointsAway={pointsAway(e.tier_required)}
                      key={e.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}
