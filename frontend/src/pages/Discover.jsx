import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Section } from "@/components/Section";
import { RestaurantTabs } from "@/components/RestaurantTabs";
import { FilterChips } from "@/components/FilterChips";
import { RestaurantCard } from "@/components/RestaurantCard";
import { TierCard } from "@/components/TierCard";
import { NetworkList } from "@/components/NetworkList";
import { EventCard } from "@/components/EventCard";
import { BookingModal } from "@/components/BookingModal";
import { StatusDot } from "@/components/StatusPill";
import { PARTNER_FILTERS, byUrgency, isUpcoming, usePartners } from "@/lib/partnersService";
import { cn } from "@/lib/utils";

const HERO_ROTATE_MS = 8000;

function greeting() {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Chef's picks and 2× nights lead the hero rotation. */
function heroOrder(a, b) {
  const score = (p) => (p.chefs_pick ? 2 : 0) + (p.double_points_tonight ? 1 : 0);
  return score(b) - score(a);
}

function HeroRotation({ partners, onHold }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const ids = partners.map((p) => p.id).join();

  useEffect(() => setIndex(0), [ids]);
  useEffect(() => {
    if (paused || partners.length < 2 || prefersReducedMotion()) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % partners.length), HERO_ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, partners.length]);

  const partner = partners[index % partners.length];
  const dots = partners.length > 1 && (
    <div className="absolute inset-x-0 bottom-2 z-[2] flex justify-center gap-1.5" role="group" aria-label="Featured partners">
      {partners.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setIndex(i)}
          aria-label={`Show ${p.name}`}
          aria-current={i === index ? "true" : undefined}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === index ? "w-4 bg-ritual-text" : "w-1.5 bg-ritual-muted hover:bg-ritual-text",
          )}
        />
      ))}
    </div>
  );

  return (
    <div
      className="desk:h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <RestaurantCard
        key={partner.id}
        partner={partner}
        variant="hero"
        onHold={onHold}
        overlay={dots}
        className="h-[400px] desk:h-full desk:min-h-[460px] animate-fade"
      />
    </div>
  );
}

export default function Discover() {
  const { user } = useAuth();
  const { data: partners = [], isLoading, isError, refetch } = usePartners();
  const [filter, setFilter] = useState("all");
  const [holding, setHolding] = useState(null);

  const match = (PARTNER_FILTERS.find((f) => f.key === filter) || PARTNER_FILTERS[0]).match;
  const filtered = useMemo(() => partners.filter(match), [partners, match]);
  const hero = useMemo(() => [...filtered].sort(heroOrder), [filtered]);
  const grid = useMemo(() => [...filtered].sort(byUrgency), [filtered]);
  const events = useMemo(() => {
    const now = new Date();
    return filtered
      .flatMap((p) => p.events.filter((e) => isUpcoming(e, now)).map((e) => ({ event: e, partner: p })))
      .sort((a, b) => `${a.event.date}${a.event.time}`.localeCompare(`${b.event.date}${b.event.time}`));
  }, [filtered]);

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <>
      <Section withNav data-testid="discover-page">
        <RestaurantTabs />

        <div className="flex flex-col gap-4 desk:flex-row desk:items-end desk:justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-ritual-muted" data-testid="partner-count">
              <StatusDot tone="open" />
              {partners.length} {partners.length === 1 ? "partner" : "partners"} live in Bandra West
            </div>
            <h1 className="tbl-h1 mt-2">
              {greeting()}, {firstName}.
            </h1>
          </div>
          <FilterChips value={filter} onChange={setFilter} />
        </div>

        {isError ? (
          <div className="tbl-panel p-8 text-center">
            <p className="text-ritual-muted">Partners couldn&apos;t load.</p>
            <button type="button" onClick={() => refetch()} className="mt-4 tbl-pill tbl-pill--filled tbl-pill--lg">
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 desk:grid-cols-[1.7fr_1fr] gap-4">
            {isLoading ? (
              <div className="tbl-panel h-[400px] desk:h-[460px]" aria-busy="true" />
            ) : hero.length ? (
              <HeroRotation partners={hero} onHold={setHolding} />
            ) : (
              <div className="tbl-panel h-[400px] desk:h-[460px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="text-ritual-muted">No partners match this filter tonight.</p>
                <button type="button" onClick={() => setFilter("all")} className="tbl-pill tbl-pill--filled tbl-pill--lg">
                  Show all partners
                </button>
              </div>
            )}
            <div className="flex flex-col gap-4 min-w-0">
              <TierCard />
              <NetworkList partners={grid} className="flex-1" />
            </div>
          </div>
        )}
      </Section>

      <Section aria-labelledby="filling-in-fast">
        <div className="tbl-eyebrow">Discover · Grid</div>
        <h2 id="filling-in-fast" className="tbl-h2 mt-1.5 scroll-mt-6">
          Filling in fast
        </h2>
        {grid.length ? (
          <div className="mt-5 grid grid-cols-2 desk:grid-cols-4 gap-3">
            {grid.map((p) => (
              <RestaurantCard key={p.id} partner={p} />
            ))}
          </div>
        ) : (
          !isLoading && <p className="mt-4 text-[14px] text-ritual-muted">Nothing matches this filter yet.</p>
        )}

        <EventsBlock events={events} className="mt-10" />
      </Section>

      {holding && <BookingModal venue={holding} onClose={() => setHolding(null)} />}
    </>
  );
}

export function EventsBlock({ events, className, heading = "h2" }) {
  const Heading = heading;
  return (
    <div className={className} data-testid="events-block">
      <Heading className="tbl-h2">Events</Heading>
      <p className="mt-1 text-[14px] text-ritual-muted">What your tier opens, across every partner.</p>
      {events.length ? (
        <div className="mt-5 grid grid-cols-1 desk:grid-cols-3 gap-3">
          {events.map(({ event, partner }) => (
            <EventCard key={event.id} event={event} partner={partner} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-ritual-muted">No upcoming events on the calendar.</p>
      )}
    </div>
  );
}
