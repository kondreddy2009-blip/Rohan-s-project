import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FillingFastCard, fillingFastStatus } from "@/components/FillingFastCard";
import { EventCard } from "@/components/EventCard";
import { BrandLockup } from "@/components/BrandLockup";
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

const NAV = [
  { label: "Discover", to: "/discover", testId: "nav-discover" },
  { label: "Events", to: "/discover#events", testId: "nav-events" },
  { label: "Wallet", to: "/wallet", testId: "nav-wallet" },
  { label: "Profile", to: "/profile", testId: "nav-profile" },
];

const panel = "w-full text-[#F4F1EC] px-5 sm:px-10 lg:px-16 py-8 sm:py-10";
const inner = "mx-auto max-w-[1280px]";

function Header({ user, points }) {
  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-4 pb-5 border-b border-white/[0.08]">
      <div className="flex items-center min-w-0">
        <Link to="/discover" data-testid="brand-home-link" className="shrink-0">
<BrandLockup />
        </Link>
      </div>
        <nav className="flex items-center justify-center gap-2 overflow-x-auto" data-testid="top-nav">
          {NAV.map((n) => (
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
        <span className="hidden sm:inline-flex rounded-full bg-[#3A2219] px-4 py-2 text-sm font-bold text-[#E27D60]">
          {points.toLocaleString("en-IN")} pts
        </span>
        <Link
          to="/profile"
          aria-label="Profile"
          className="grid h-10 w-10 place-items-center rounded-lg bg-[#D8694A] text-sm font-extrabold text-[#1A0F0B]"
        >
          {(user?.name || "G").trim()[0].toUpperCase()}
        </Link>
      </div>
    </header>
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
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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
    api.get("/wallet").then(({ data }) => !cancelled && setWallet(data)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const filtered = useMemo(() => venues.filter(active.match), [venues, active]);
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
              {greeting}, {firstName}.
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

        {loading ? (
          <div className="mt-16 text-center text-sm text-[#8E8982]">Loading rooms…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-sm text-[#8E8982]">No rooms match tonight.</div>
        ) : (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.62fr_1fr] gap-5">
            <Hero venue={featured} />
            <div className="flex flex-col gap-5">
              <TierCard wallet={info} partners={partners} />
              <Tonight venues={tonight} />
            </div>
          </div>
        )}
        </div>
      </section>

      {!loading && (
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
    </div>
  );
}
