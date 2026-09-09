import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shuffle, ChefHat, Flame } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { VenueCard, VibePill } from "@/components/VenueCard";
import { StatusIndicator } from "@/components/StatusIndicator";
import { TierBadge } from "@/components/TierBadge";
import { cn } from "@/lib/utils";

const VIBE_FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "chefs-pick", label: "Chef's Picks", match: (v) => v.vibes?.includes("Chef's Pick") },
  { key: "date-night", label: "Date Night", match: (v) => v.vibes?.includes("Date Night") },
  { key: "buzzing", label: "Buzzing", match: (v) => v.vibes?.includes("Buzzing") || v.status === "At Capacity" },
  { key: "solo", label: "Solo", match: (v) => v.vibes?.includes("Solo-Friendly") },
  { key: "group", label: "Groups", match: (v) => v.vibes?.includes("Group-Friendly") },
  { key: "new", label: "Just Opened", match: (v) => v.vibes?.includes("Just Opened") },
];

function FeaturedRoom({ venue }) {
  if (!venue) return null;
  const priceStr = "₹".repeat(venue.price_level || 3);
  return (
    <Link
      to={`/venues/${venue.id}`}
      data-testid={`featured-${venue.id}`}
      className="block relative overflow-hidden group card-invite mt-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-5">
        <div className="md:col-span-3 relative aspect-[4/3] md:aspect-auto md:min-h-[360px]">
          <img
            src={venue.image_url}
            alt={venue.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r md:bg-gradient-to-r from-transparent to-[#2E1220]/60 md:to-[#2E1220]" />
          <div className="absolute top-5 left-5 inline-flex items-center gap-2 overline-accent">
            <Flame strokeWidth={1.4} className="h-3.5 w-3.5" />
            Chef&apos;s pick tonight
          </div>
        </div>
        <div className="md:col-span-2 p-6 sm:p-8 flex flex-col justify-center gap-3 bg-[#2E1220]">
          <div className="overline">
            {venue.neighborhood} · {venue.cuisine}
          </div>
          <h2 className="font-serif-display text-4xl sm:text-5xl leading-[0.98]">
            {venue.name}
          </h2>
          <p className="font-serif italic text-lg text-[#F4E8DA]/80">
            &ldquo;{venue.tagline}&rdquo;
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {(venue.vibes || []).map((v) => (
              <VibePill key={v} vibe={v} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 overline">
            <StatusIndicator status={venue.status} queueLength={venue.queue_length} />
            <span className="text-[#C2A36B] tracking-widest">{priceStr}</span>
            {venue.chef && (
              <span className="inline-flex items-center gap-1 text-[#F4E8DA]/60">
                <ChefHat strokeWidth={1.2} className="h-3 w-3" />
                {venue.chef}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await api.get("/venues");
        if (!cancelled) setVenues(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = VIBE_FILTERS.find((f) => f.key === filter) || VIBE_FILTERS[0];
  const featured = useMemo(
    () => venues.find((v) => v.vibes?.includes("Chef's Pick") && v.featured) || venues.find((v) => v.featured),
    [venues],
  );
  const filtered = useMemo(
    () => venues.filter(active.match),
    [venues, active],
  );

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 4
      ? "After midnight"
      : hour < 11
        ? "This morning"
        : hour < 15
          ? "Lunch service"
          : hour < 17
            ? "Aperitivo soon"
            : hour < 20
              ? "Dinner is on"
              : hour < 22
                ? "The room is on"
                : "Late service";

  const surpriseMe = () => {
    if (filtered.length === 0 || rolling) return;
    setRolling(true);
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setTimeout(() => {
      setRolling(false);
      navigate(`/venues/${pick.id}`);
    }, 600);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-8 sm:pt-14 pb-16" data-testid="discover-page">
      <div className="animate-fade-up">
        <div className="overline inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[#C2A36B] status-dot-pulse" />
          {timeGreeting} · Six rooms
        </div>
        <div className="mt-3 flex items-end justify-between flex-wrap gap-4">
          <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
            <span className="italic text-[#C2A36B]">{user?.name?.split(" ")[0] || "Guest"}</span>,
            <br />
            your Table continues.
          </h1>
          <TierBadge tier={user?.tier} testId="header-tier-badge" />
        </div>
      </div>

      {!loading && featured && <FeaturedRoom venue={featured} />}

      <div className="mt-12 flex items-center justify-between gap-4 border-b border-[#4E1E32] overflow-x-auto">
        <div className="flex items-center gap-1" role="tablist" data-testid="discover-filters">
          {VIBE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}`}
              role="tab"
              aria-selected={filter === f.key}
              className={cn(
                "px-4 py-3 overline transition-colors duration-300 border-b -mb-px whitespace-nowrap",
                filter === f.key
                  ? "text-[#C2A36B] border-[#C2A36B]"
                  : "text-[#B39586] border-transparent hover:text-[#F4E8DA]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={surpriseMe}
          disabled={rolling || filtered.length === 0}
          data-testid="surprise-me-button"
          className="overline inline-flex items-center gap-2 text-[#C2A36B] hover:text-[#F4E8DA] transition-colors duration-300 pr-2 whitespace-nowrap"
          aria-label="Pick a random room"
        >
          <Shuffle
            strokeWidth={1.2}
            className={`h-4 w-4 transition-transform duration-500 ${rolling ? "rotate-180" : ""}`}
          />
          Surprise me
        </button>
      </div>

      {loading ? (
        <div className="mt-16 overline text-center">Loading rooms…</div>
      ) : (
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filtered.map((v, i) => (
            <VenueCard venue={v} index={i} key={v.id} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="mt-16 text-center overline">No rooms in this category tonight.</div>
      )}
    </div>
  );
}
