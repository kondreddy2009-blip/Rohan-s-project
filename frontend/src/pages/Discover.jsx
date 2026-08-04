import { useEffect, useMemo, useState } from "react";
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
  const [venues, setVenues] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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
    hour >= 22 || hour < 4
      ? "Late tonight"
      : hour >= 17
        ? "This evening"
        : "The night ahead";

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-8 sm:pt-14 pb-16" data-testid="discover-page">
      <div className="animate-fade-up">
        <div className="overline">{timeGreeting} · Six rooms</div>
        <div className="mt-3 flex items-end justify-between flex-wrap gap-4">
          <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
            <span className="italic text-[#C2A36B]">{user?.name?.split(" ")[0] || "Guest"}</span>,
            <br />
            your Nocturne continues.
          </h1>
          <TierBadge tier={user?.tier} testId="header-tier-badge" />
        </div>
      </div>

      <div
        className="mt-10 flex items-center gap-1 border-b border-[#2A2A2A] overflow-x-auto"
        role="tablist"
        data-testid="discover-filters"
      >
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
                : "text-[#8E8E8E] border-transparent hover:text-[#F4F4EE]",
            )}
          >
            {f.label}
          </button>
        ))}
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
