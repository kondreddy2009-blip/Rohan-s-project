import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, ArrowRight, MapPin, UtensilsCrossed, Star, Flame, Heart, CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePageTitle } from "@/lib/usePageTitle";
import { fillingFastStatus } from "@/components/FillingFastCard";
import { cn } from "@/lib/utils";

const serif = "font-['Cormorant_Garamond']";
const pill = "rounded-full border border-white/10 bg-[#141312]/90 backdrop-blur-sm";

const isWalkIn = (v) =>
  v.availability !== "fully_booked" && v.status !== "At Capacity" && !(v.wait_minutes > 0);
const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "walk-in", label: "Walk-in now", match: isWalkIn },
  { key: "under-800", label: "Under ₹800", match: (v) => (v.price_level || 3) <= 2 },
  { key: "2x", label: "2x points", match: (v) => (v.loyalty_points_per_checkin || 0) >= 10 },
];

function Select({ icon: Icon, children, ...props }) {
  return (
    <div className="relative">
      <Icon strokeWidth={1.6} className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#CE6A4A]" />
      <select
        {...props}
        className={cn(pill, "appearance-none cursor-pointer py-3 pl-11 pr-10 text-[14px] text-[#D8CBB9] outline-none hover:text-white focus:border-[#CE6A4A]/60")}
      >
        {children}
      </select>
      <ChevronDown strokeWidth={2} className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8AA98]" />
    </div>
  );
}

function SectionHead({ icon, title, subtitle, to, onPrev, onNext }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-1.5">{icon}</span>
        <div>
          <h2 className={cn(serif, "text-[34px] font-semibold leading-none text-white")}>{title}</h2>
          <p className="mt-2 text-[14px] text-[#B8AA98]">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link to={to} className={cn(pill, "border-[#CE6A4A]/30 px-6 py-2.5 text-[13px] font-medium text-[#EE9B79] hover:text-white")}>
          View all
        </Link>
        {[[-1, ChevronLeft, onPrev, "Previous"], [1, ChevronRight, onNext, "Next"]].map(([d, Icon, fn, label]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={fn}
            className={cn(pill, "grid h-11 w-11 place-items-center border-[#CE6A4A]/30 text-[#EE9B79] hover:text-white")}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function VenueTile({ venue }) {
  const { label, dot } = fillingFastStatus(venue);
  const [liked, setLiked] = useState(false);
  return (
    <Link
      to={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#141312]"
      data-testid={`home-venue-${venue.id}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={venue.image_url} alt={venue.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        {venue.featured ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#F2EDE7] px-3.5 py-1.5 text-[13px] font-semibold text-[#1B1917]">
            <Star className="h-3.5 w-3.5 fill-current" /> Trending
          </span>
        ) : (
          <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
            <span className={cn("h-2 w-2 rounded-full", dot)} /> {label}
          </span>
        )}
        <button
          type="button"
          aria-label={liked ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={liked}
          onClick={(e) => {
            e.preventDefault();
            setLiked((v) => !v);
          }}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white hover:bg-black/40"
        >
          <Heart strokeWidth={1.6} className={liked ? "h-5 w-5 fill-[#F07F5E] text-[#F07F5E]" : "h-5 w-5"} />
        </button>
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className={cn(serif, "truncate text-[26px] font-semibold leading-tight text-white")}>{venue.name}</h3>
            <div className="truncate text-[13px] text-white/80">
              {[venue.cuisine, venue.neighborhood].filter(Boolean).join(" · ")}
            </div>
          </div>
          {venue.rating_count > 0 && (
            <span className="flex shrink-0 items-center gap-1 pb-0.5 text-[14px] text-white">
              <Star className="h-4 w-4 fill-[#E8A33D] text-[#E8A33D]" />
              {Number(venue.rating_avg).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-4 text-[13px] text-[#D8CBB9]">
          <span className="font-medium">{"₹".repeat(venue.price_level || 3)}</span>
          {venue.neighborhood && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin strokeWidth={1.6} className="h-4 w-4 shrink-0 text-[#CE6A4A]" />
              <span className="truncate">{venue.neighborhood}</span>
            </span>
          )}
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/70 text-white group-hover:bg-white group-hover:text-black transition-colors">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function EventTile({ event }) {
  const d = new Date(`${event.date}T${event.time || "00:00"}`);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined, hour12: true });
  const left = event.capacity ? Math.max(event.capacity - (event.rsvp_count || 0), 0) : null;
  return (
    <Link
      to={`/venues/${event.venue_id}`}
      className="group relative flex h-[132px] items-center gap-5 overflow-hidden rounded-2xl border border-white/10 bg-[#141312] px-4"
      data-testid={`home-event-${event.id}`}
    >
      {event.venue_image_url && (
        <img src={event.venue_image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0E0D0C]/80 via-[#0E0D0C]/40 to-[#0E0D0C]/20" />
      <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl bg-[#F6E3DA] text-center leading-none text-[#1B1917]">
        <div>
          <div className={cn(serif, "text-[34px] font-semibold")}>{d.getDate()}</div>
          <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide">
            {d.toLocaleDateString("en-GB", { month: "short" })}
          </div>
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <h3 className={cn(serif, "truncate text-[28px] font-semibold leading-tight text-white")}>{event.title}</h3>
        <div className="mt-1 text-[14px] text-white/85">
          {time}
          {left !== null && ` · ${left} seats left`}
        </div>
      </div>
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/60 bg-black/30 text-white">
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function MemberHome() {
  usePageTitle("Home");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [hood, setHood] = useState("");
  const [tab, setTab] = useState("all");
  const venuesRef = useRef(null);
  const eventsRef = useRef(null);

  useEffect(() => {
    api.get("/venues").then(({ data }) => setVenues(data)).catch(() => {});
    api.get("/events").then(({ data }) => setEvents(data)).catch(() => {});
  }, []);

  const cuisines = useMemo(() => [...new Set(venues.map((v) => v.cuisine).filter(Boolean))].sort(), [venues]);
  const hoods = useMemo(() => [...new Set(venues.map((v) => v.neighborhood).filter(Boolean))].sort(), [venues]);
  const popular = useMemo(() => {
    const match = TABS.find((t) => t.key === tab).match;
    return venues
      .filter(match)
      .filter((v) => !cuisine || v.cuisine === cuisine)
      .filter((v) => !hood || v.neighborhood === hood);
  }, [venues, tab, cuisine, hood]);

  const scroll = (ref, dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/discover${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };
  const backdrop = venues[0]?.image_url;
  const hide = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div className="relative overflow-hidden bg-[#0E0D0C] text-[#F4EBDD]" data-testid="member-home">
      {backdrop && (
        <div className="pointer-events-none absolute right-0 top-0 hidden h-[520px] w-[60%] md:block">
          <img src={backdrop} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0E0D0C] via-[#0E0D0C]/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0E0D0C]" />
        </div>
      )}
      <span className="pointer-events-none absolute right-16 top-6 hidden -rotate-6 font-['Mrs_Saint_Delafield'] text-[60px] leading-[0.85] text-[#CE6A4A]/90 lg:block">
        Good<br />&nbsp;Food<br />&nbsp;&nbsp;Better<br />&nbsp;&nbsp;&nbsp;Company
      </span>

      <div className="relative mx-auto max-w-[1280px] px-5 pb-12 sm:px-10 lg:px-16">
        {/* Hero */}
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8A27F]">
          Good food brings people together <span className="h-px w-8 bg-[#E8A27F]" />
        </div>
        <h1 className={cn(serif, "mt-4 text-[56px] sm:text-[68px] font-semibold leading-none text-white")}>
          Discover. Dine. <span className="text-[#F3B98C]">Earn.</span>
        </h1>
        <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-[#D8CBB9]">
          {user?.name ? `Welcome back, ${user.name.split(" ")[0]}. ` : ""}Explore curated restaurants, unique dining experiences and exciting events across your city.
        </p>

        <form onSubmit={onSearch} className={cn(pill, "mt-8 flex max-w-[880px] items-center gap-4 border-white/15 px-6 py-1")}>
          <Search strokeWidth={1.6} className="h-5 w-5 shrink-0 text-[#CE6A4A]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search restaurants, cuisines, or events..."
            aria-label="Search"
            data-testid="home-search"
            className="min-w-0 flex-1 bg-transparent py-4 text-[16px] text-white outline-none placeholder:text-[#8E8271]"
          />
          <span className="hidden h-8 w-px bg-white/15 sm:block" />
          <span className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-[#D8CBB9] sm:flex">
            <MapPin strokeWidth={1.6} className="h-4 w-4 text-[#CE6A4A]" /> Current location <ChevronDown className="ml-2 h-4 w-4" />
          </span>
        </form>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Select icon={UtensilsCrossed} value={cuisine} onChange={(e) => setCuisine(e.target.value)} aria-label="Cuisine">
            <option value="">All cuisines</option>
            {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select icon={MapPin} value={hood} onChange={(e) => setHood(e.target.value)} aria-label="Neighborhood">
            <option value="">All neighborhoods</option>
            {hoods.map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
          <div className="flex flex-wrap gap-2 lg:ml-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  pill, "flex items-center gap-1.5 px-5 py-3 text-[14px] font-medium transition-colors",
                  tab === t.key ? "border-[#F2EDE7] bg-[#F2EDE7] text-[#1B1917]" : "text-[#D8CBB9] hover:text-white",
                )}
              >
                {t.label}
                {t.key === "2x" && <Star className="h-3.5 w-3.5 fill-[#E8A33D] text-[#E8A33D]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Popular right now */}
        <section className="mt-12" data-testid="home-popular">
          <SectionHead
            icon={<Flame className="h-6 w-6 fill-[#F07F5E]/30 text-[#F07F5E]" />}
            title="Popular right now"
            subtitle="Trending restaurants loved by the community."
            to="/discover"
            onPrev={() => scroll(venuesRef, -1)}
            onNext={() => scroll(venuesRef, 1)}
          />
          {popular.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 py-14 text-center text-sm text-[#9C8F7E]">
              No restaurants match these filters.
            </div>
          ) : (
            <div ref={venuesRef} className={cn("mt-6 flex snap-x gap-5 overflow-x-auto pb-2", hide)}>
              {popular.map((v) => (
                <div key={v.id} className="w-[82%] shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)]">
                  <VenueTile venue={v} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming events */}
        {events.length > 0 && (
          <section className="mt-12" data-testid="home-events">
            <SectionHead
              icon={<CalendarDays strokeWidth={1.5} className="h-6 w-6 text-[#F07F5E]" />}
              title="Upcoming events"
              subtitle="Exclusive dining experiences across partner restaurants."
              to="/events"
              onPrev={() => scroll(eventsRef, -1)}
              onNext={() => scroll(eventsRef, 1)}
            />
            <div ref={eventsRef} className={cn("mt-6 flex snap-x gap-5 overflow-x-auto pb-2", hide)}>
              {events.map((e) => (
                <div key={e.id} className="w-[88%] shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
                  <EventTile event={e} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
