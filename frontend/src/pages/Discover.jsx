import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shuffle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { VenueCard } from "@/components/VenueCard";
import { TierBadge } from "@/components/TierBadge";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "bar", label: "Bars", match: (v) => /bar|speakeasy/i.test(v.type) },
  { key: "lounge", label: "Lounges", match: (v) => /lounge/i.test(v.type) },
  {
    key: "table",
    label: "Tables",
    match: (v) => /bistro|club|dining/i.test(v.type),
  },
];

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

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const filtered = useMemo(
    () => venues.filter(activeFilter.match),
    [venues, activeFilter],
  );

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 4
      ? "After midnight"
      : hour < 11
        ? "The night ahead"
        : hour < 17
          ? "Aperitivo soon"
          : hour < 20
            ? "Cocktail hour"
            : hour < 22
              ? "The night is on"
              : "Late hours";

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
            your Nocturne continues.
          </h1>
          <TierBadge tier={user?.tier} testId="header-tier-badge" />
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4 border-b border-[#253453] overflow-x-auto">
        <div className="flex items-center gap-1" role="tablist" data-testid="discover-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}`}
              role="tab"
              aria-selected={filter === f.key}
              className={cn(
                "px-5 py-3 overline transition-colors duration-300 border-b -mb-px whitespace-nowrap",
                filter === f.key
                  ? "text-[#C2A36B] border-[#C2A36B]"
                  : "text-[#8996B0] border-transparent hover:text-[#E8ECF5]",
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
          className="overline inline-flex items-center gap-2 text-[#C2A36B] hover:text-[#E8ECF5] transition-colors duration-300 pr-2 whitespace-nowrap"
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
