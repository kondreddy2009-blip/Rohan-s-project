import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FillingFastCard, fillingFastStatus } from "@/components/FillingFastCard";
import { EventCard } from "@/components/EventCard";
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

const NAV = [
  { label: "Discover", to: "/discover", testId: "nav-discover" },
  { label: "Events", to: "/discover#events", testId: "nav-events" },
  { label: "Bookings", to: "/bookings", testId: "nav-bookings" },
  { label: "Wallet", to: "/wallet", testId: "nav-wallet" },
  { label: "Profile", to: "/profile", testId: "nav-profile" },
];

const panel = "w-full text-[#F4F1EC] px-5 sm:px-10 lg:px-16 py-8 sm:py-10";
const inner = "mx-auto max-w-[1280px]";

function Header({ user, points }) {
  const signedIn = !!user;
  const nav = signedIn ? NAV : NAV.filter((n) => n.label === "Discover" || n.label === "Events");
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 pb-5 border-b border-white/[0.08]">
      <div className="flex items-center min-w-0">
        <Link to="/discover" data-testid="brand-home-link" className="shrink-0">
<BrandLockup />
        </Link>
      </div>
        <nav className="flex items-center justify-center gap-2 overflow-x-auto" data-testid="top-nav">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              data-testid={n.testId}
              onClick={() => {
                if (n.to.endsWith("#events")) {
                  document.getElementById("events")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className={cn(
                "rounded-full px-6 py-3 text-base font-semibold whitespace-nowrap transition-colors",
                n.label === "Discover"
                  ? "bg-[#2A2826] text-white"
                  : "text-[#8E8982] hover:text-white",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      <div className="flex items-center gap-3 shrink-0">
        {user === null ? null : signedIn ? (
          <>
            <span className="hidden sm:inline-flex rounded-full bg-[#3A2219] px-4 py-2 text-sm font-bold text-[#E27D60]">
              {points.toLocaleString("en-IN")} pts
            </span>
            <Link
              to="/profile"
              aria-label="Profile"
              title={user.name || "Profile"}
              data-testid="header-profile-button"
              className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#E27D60] to-[#B8533A] text-sm font-semibold tracking-wide text-[#1A0F0B] ring-1 ring-white/15 ring-offset-2 ring-offset-[#141312] shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-all duration-200 hover:ring-white/40 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E27D60]"
            >
              {(user.name || "G").trim()[0].toUpperCase()}
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" data-testid="discover-signin" className="px-3 py-2 text-sm font-semibold text-[#B8B2AA] hover:text-white">
              Sign in
            </Link>
            <Link
              to="/login"
              state={{ mode: "create" }}
              className="rounded-full bg-[#D8694A] px-5 py-2.5 text-sm font-extrabold text-[#1A0F0B] hover:bg-[#E27D60] transition-colors"
            >
              Join free
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

const selectCls =
  "rounded-full bg-[#2A2826] px-4 py-2.5 text-[13px] font-semibold text-[#B8B2AA] outline-none focus:ring-1 focus:ring-[#D8694A] appearance-none cursor-pointer";

function SearchBar({ query, setQuery, cuisine, setCuisine, cuisines, hood, setHood, hoods, price, setPrice, sort, setSort, activeCount, onClear }) {
  return (
    <div className="mt-6 space-y-3" data-testid="discover-search">
      <div className="relative">
        <Search strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8E8982]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, cuisines or neighborhoods"
          aria-label="Search restaurants"
          data-testid="discover-search-input"
          className="w-full rounded-2xl bg-[#1F1D1B] py-4 pl-12 pr-12 text-[15px] text-white outline-none ring-1 ring-white/[0.06] focus:ring-[#D8694A] placeholder:text-[#6F6A64] transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8982] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal strokeWidth={1.6} className="h-4 w-4 text-[#8E8982] mr-1" />
        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={selectCls} aria-label="Cuisine" data-testid="filter-cuisine">
          <option value="">All cuisines</option>
          {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={hood} onChange={(e) => setHood(e.target.value)} className={selectCls} aria-label="Neighborhood" data-testid="filter-neighborhood">
          <option value="">All neighborhoods</option>
          {hoods.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <div className="flex gap-1" role="group" aria-label="Price">
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              type="button"
              aria-pressed={price === lvl}
              data-testid={`filter-price-${lvl}`}
              onClick={() => setPrice(price === lvl ? 0 : lvl)}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
                price === lvl ? "bg-[#F5F5F3] text-[#171513]" : "bg-[#2A2826] text-[#B8B2AA] hover:text-white",
              )}
            >
              {"₹".repeat(lvl)}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={cn(selectCls, "sm:ml-auto")} aria-label="Sort" data-testid="sort-select">
          {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} data-testid="clear-filters" className="px-2 py-2 text-[13px] font-bold text-[#E27D60] hover:text-[#F4764F]">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function Hero({ venue }) {
  if (!venue) return null;
  const { label, dot } = fillingFastStatus(venue);
  const reordered = (venue.regulars_order || venue.signature_offerings?.map((o) => o.name) || []).slice(0, 2);
  const tags = [
    venue.loyalty_points_per_checkin >= 10 ? "2x points tonight" : null,
    ...(venue.vibes || []).slice(0, 1),
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl bg-[#1F1D1B]" data-testid={`featured-${venue.id}`}>
      <div className="relative min-h-[420px] sm:min-h-[556px]">
        <img src={venue.image_url} alt={venue.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
        <div className="absolute inset-x-5 top-5 flex items-start justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
            {venue.status === "Quiet" ? `Quiet · ${label.toLowerCase()}` : label}
          </span>
          <span className="rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            {"₹".repeat(venue.price_level || 3)}
          </span>
        </div>
        <div className="absolute inset-x-6 bottom-6">
          <div className="text-[13px] font-semibold text-white/75">
            {venue.neighborhood} · {venue.cuisine}
          </div>
          <h2 className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">{venue.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t, i) => (
              <span
                key={t}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  i === 0 && t.includes("points")
                    ? "bg-[#4A2A20] text-[#E27D60]"
                    : "bg-white/15 text-white backdrop-blur-sm",
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <div className="text-xs text-[#8E8982]">Most re-ordered</div>
          <div className="mt-0.5 text-[15px] font-bold truncate">{reordered.join(" · ") || venue.tagline}</div>
        </div>
        <Link
          to={`/venues/${venue.id}`}
          className="shrink-0 rounded-full bg-[#D8694A] px-6 py-3 text-sm font-extrabold text-[#1A0F0B] hover:bg-[#E27D60] transition-colors"
        >
          Hold table
        </Link>
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

function TierCard({ wallet, partners }) {
  const tier = wallet?.tier || "Guest";
  const pts = wallet?.lifetime_points || 0;
  return (
    <div
      className="rounded-2xl p-6 text-[#1A0F0B] bg-gradient-to-br from-[#CC6A4C] to-[#8E4132]"
      data-testid="tier-card"
    >
      <div className="text-[11px] font-extrabold tracking-[0.16em] uppercase opacity-70">Table tier</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-4xl font-extrabold tracking-tight">{tier}</div>
        <div className="text-right text-xs font-bold leading-snug">
          {pts.toLocaleString("en-IN")} pts
          <br />
          {partners} partner{partners === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-black/25">
        <div
          className="h-full rounded-full bg-[#1A0F0B]"
          style={{ width: `${wallet?.progress_percent ?? 0}%` }}
        />
      </div>
      <div className="mt-3 text-xs font-bold">
        {wallet?.next_tier
          ? `${wallet.points_to_next.toLocaleString("en-IN")} more pts for ${wallet.next_tier}`
          : "You're at the top tier"}
      </div>
    </div>
  );
}

function JoinCard() {
  return (
    <div
      className="rounded-2xl p-6 text-[#1A0F0B] bg-gradient-to-br from-[#CC6A4C] to-[#8E4132]"
      data-testid="join-card"
    >
      <div className="text-[11px] font-extrabold tracking-[0.16em] uppercase opacity-70">Table members</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight leading-tight">Earn at the tables you love. Redeem right there.</div>
      <p className="mt-2 text-sm font-semibold opacity-80">Free to join. Points start from your first check-in.</p>
      <Link
        to="/login"
        state={{ mode: "create" }}
        className="mt-4 inline-block rounded-full bg-[#1A0F0B] px-6 py-3 text-sm font-extrabold text-white hover:bg-black transition-colors"
      >
        Join free
      </Link>
    </div>
  );
}

function Tonight({ venues }) {
  return (
    <div className="rounded-2xl bg-[#1F1D1B] p-6 flex-1" data-testid="tonight-list">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Tonight across the network</h3>
        <a href="#events" className="text-xs font-bold text-[#E27D60]">Events</a>
      </div>
      <ul className="mt-3">
        {venues.map((v, i) => {
          const { label, dot } = fillingFastStatus(v);
          return (
            <li key={v.id} className={cn(i > 0 && "border-t border-white/[0.08]")}>
              <Link to={`/venues/${v.id}`} className="flex items-center gap-3 py-3">
                <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{v.name}</div>
                  <div className="text-xs text-[#8E8982] truncate">
                    {v.neighborhood} · {v.cuisine}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#B8B2AA] whitespace-nowrap">{label}</span>
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
  const [query, setQuery] = useState("");
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

  return (
    <div className="min-h-screen bg-[#171513]" data-testid="discover-page">
      <section className={panel}>
        <div className={inner}>
        <Header user={user} points={points} />

        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8982]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7DBE8A]" />
              {venues.length} partners live tonight
            </div>
            <h1 className="mt-1.5 text-4xl sm:text-[40px] font-extrabold tracking-[-0.04em] leading-tight">
              {user ? `${greeting}, ${firstName}.` : "Find your next table."}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" data-testid="discover-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                data-testid={`filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                  filter === f.key
                    ? "bg-[#F5F5F3] text-[#171513]"
                    : "bg-[#2A2826] text-[#B8B2AA] hover:text-white",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <SearchBar
          query={query} setQuery={setQuery}
          cuisine={cuisine} setCuisine={setCuisine} cuisines={cuisines}
          hood={hood} setHood={setHood} hoods={hoods}
          price={price} setPrice={setPrice}
          sort={sort} setSort={setSort}
          activeCount={activeCount} onClear={clearAll}
        />

        {loading ? (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-5" aria-busy="true" data-testid="discover-skeleton">
            <Skeleton className="min-h-[420px] sm:min-h-[556px] rounded-2xl bg-white/[0.06]" />
            <div className="flex flex-col gap-5">
              <Skeleton className="h-44 rounded-2xl bg-white/[0.06]" />
              <Skeleton className="flex-1 min-h-[220px] rounded-2xl bg-white/[0.06]" />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center" data-testid="no-results">
            <div className="text-sm text-[#8E8982]">No restaurants match your search.</div>
            {(searching || filter !== "all") && (
              <button
                type="button"
                onClick={() => { clearAll(); setFilter("all"); }}
                className="mt-4 rounded-full bg-[#2A2826] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#34312E]"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : searching ? (
          <div data-testid="search-results">
            <div className="mt-8 text-sm font-semibold text-[#8E8982]">
              {filtered.length} restaurant{filtered.length === 1 ? "" : "s"}
            </div>
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((v) => <FillingFastCard venue={v} key={v.id} />)}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-5">
            <Hero venue={featured} />
            <div className="flex flex-col gap-5">
              {user ? <TierCard wallet={info} partners={partners} /> : <JoinCard />}
              <Tonight venues={tonight} />
            </div>
          </div>
        )}
        </div>
      </section>

      {!loading && !searching && (
        <section className={cn(panel, "border-t border-white/[0.06]")} data-testid="filling-fast-section">
          <div className={inner}>
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8E8982]">
            Discover · Grid
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.03em]">Filling in fast</h2>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {fillingFast.map((v) => (
              <FillingFastCard venue={v} key={v.id} />
            ))}
          </div>

          {events.length > 0 && (
            <div id="events" className="mt-12 scroll-mt-6" data-testid="events-section">
              <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Events</h2>
              <p className="mt-1 text-sm text-[#8E8982]">What your tier opens, across every partner.</p>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((e) => (
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
