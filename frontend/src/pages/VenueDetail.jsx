import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Calendar, Clock, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StatusIndicator } from "@/components/StatusIndicator";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

export default function VenueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get(`/venues/${id}`);
        if (!cancelled) setVenue(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 overline text-center">
        Loading room…
      </div>
    );
  }
  if (!venue) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="overline">This room could not be found.</div>
        <Link to="/discover" className="btn-ghost mt-6 inline-block">Return</Link>
      </div>
    );
  }

  const userTierIdx = TIER_ORDER.indexOf(user?.tier || "Guest");

  return (
    <div className="pb-20" data-testid="venue-detail-page">
      {/* Hero */}
      <section className="relative h-[68vh] min-h-[420px] max-h-[720px] overflow-hidden">
        <img src={venue.image_url} alt={venue.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F0F]/50 via-[#0F0F0F]/20 to-[#0F0F0F]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/50 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          data-testid="venue-back-button"
          className="absolute top-5 left-5 flex items-center gap-1 overline hover:text-[#C2A36B] transition-colors duration-300"
        >
          <ChevronLeft strokeWidth={1.2} className="h-4 w-4" />
          Back
        </button>

        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-10 pb-10">
          <div className="mx-auto max-w-4xl animate-fade-up">
            <div className="flex items-center gap-4 mb-4">
              <StatusIndicator status={venue.status} testId="venue-status" />
              <span className="overline">{venue.type}</span>
              <span className="overline hidden sm:inline">{venue.neighborhood}</span>
            </div>
            <h1
              className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight"
              data-testid="venue-name"
            >
              {venue.name}
            </h1>
            <p className="mt-4 max-w-xl text-[#F4F4EE]/80 italic font-serif text-lg sm:text-xl">
              {venue.tagline}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 sm:px-10 py-12 space-y-16">
        {/* Description + facts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="md:col-span-2 animate-fade-up">
            <div className="overline mb-3">The room</div>
            <p className="text-[#F4F4EE]/85 text-base leading-relaxed font-light">
              {venue.description}
            </p>
          </div>
          <div className="space-y-5 animate-fade-up delay-100">
            <div>
              <div className="overline mb-2">Hours</div>
              <div className="flex items-center gap-2 text-[#F4F4EE]/85 font-light">
                <Clock strokeWidth={1.2} className="h-4 w-4 text-[#8E8E8E]" />
                {venue.hours}
              </div>
            </div>
            <div>
              <div className="overline mb-2">Neighborhood</div>
              <div className="flex items-center gap-2 text-[#F4F4EE]/85 font-light">
                <MapPin strokeWidth={1.2} className="h-4 w-4 text-[#8E8E8E]" />
                {venue.neighborhood}
              </div>
            </div>
            <div>
              <div className="overline mb-2">Room energy</div>
              <StatusIndicator status={venue.status} />
            </div>
          </div>
        </div>

        {/* Signature offerings */}
        <div className="hairline-t pt-10 animate-fade-up">
          <div className="overline mb-6">What regulars order</div>
          <div className="space-y-4">
            {(venue.signature_offerings || []).map((o, i) => (
              <div
                key={o.name}
                className="flex items-baseline justify-between gap-6 pb-4 border-b border-white/[0.05]"
                data-testid={`offering-${i}`}
              >
                <div className="flex items-baseline gap-5">
                  <span className="font-serif text-[#C2A36B] text-lg tabular-nums w-8">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif-display text-2xl">{o.name}</span>
                </div>
                <div className="overline">
                  {o.order_count} returned
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        {venue.events && venue.events.length > 0 && (
          <div className="hairline-t pt-10 animate-fade-up">
            <div className="overline mb-6">On the calendar</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {venue.events.map((e) => {
                const gated =
                  e.tier_required && TIER_ORDER.indexOf(e.tier_required) > userTierIdx;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "p-6 border border-white/[0.05] bg-[#161616]",
                      gated && "opacity-90",
                    )}
                    data-testid={`event-${e.id}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar strokeWidth={1.2} className="h-3.5 w-3.5 text-[#8E8E8E]" />
                      <span className="overline">
                        {e.date} · {e.time}
                      </span>
                    </div>
                    <h3 className="font-serif-display text-2xl mb-2">{e.title}</h3>
                    <p className="text-sm text-[#8E8E8E] font-light leading-relaxed">
                      {e.description}
                    </p>
                    {e.tier_required && (
                      <div className="mt-4 overline-accent">
                        {gated ? `${e.tier_required} Access` : `Open to ${e.tier_required}+`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary action */}
        <div className="hairline-t pt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 animate-fade-up">
          <div>
            <div className="overline mb-2">A moment awaits</div>
            <div className="font-serif-display text-3xl">Begin your Ritual at {venue.name}.</div>
          </div>
          <Link
            to={`/checkin/${venue.id}`}
            data-testid="begin-ritual-button"
            className="btn-primary text-center"
          >
            Begin Ritual
          </Link>
        </div>
      </div>
    </div>
  );
}
