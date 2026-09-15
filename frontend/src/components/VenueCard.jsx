import { Link } from "react-router-dom";
import { StatusIndicator } from "@/components/StatusIndicator";

const VIBE_COLORS = {
  "Chef's Pick": "bg-[#CE6A4A]/18 text-[#EE9B79]",
  "Insider Access": "bg-[#CE6A4A]/18 text-[#EE9B79]",
  "Date Night": "bg-[#CE6A4A]/18 text-[#EE9B79]",
  Buzzing: "bg-[#CE6A4A]/18 text-[#EE9B79]",
  "Just Opened": "bg-[#C77F73]/18 text-[#D9A79C]",
  "Solo-Friendly": "bg-[#79A17F]/18 text-[#9FC2A5]",
  "Neighborhood Favorite": "bg-[#79A17F]/18 text-[#9FC2A5]",
  "Group-Friendly": "bg-[#D69A3F]/18 text-[#E8C08A]",
};

export function VibePill({ vibe, className = "" }) {
  const color = VIBE_COLORS[vibe] || "bg-white/10 text-white/70";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${color} ${className}`}
      data-testid={`vibe-${vibe.replace(/[^a-z]+/gi, "-").toLowerCase()}`}
    >
      {vibe}
    </span>
  );
}

export function VenueCard({ venue, index = 0 }) {
  const topOffering = venue.signature_offerings?.[0]?.name;
  const priceStr = "$".repeat(venue.price_level || 3);
  const vibes = venue.vibes || [];
  const primaryVibe = vibes[0];

  return (
    <Link
      to={`/venues/${venue.id}`}
      className="group block card-invite animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
      data-testid={`venue-card-${venue.id}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={venue.image_url}
          alt={venue.name}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A0A] via-[#0B0A0A]/20 to-transparent" />

        {/* Top-left status */}
        <div className="absolute left-5 top-5">
          <StatusIndicator status={venue.status} />
        </div>

        {/* Top-right vibe pill */}
        {primaryVibe && (
          <div className="absolute right-5 top-5">
            <VibePill vibe={primaryVibe} />
          </div>
        )}

        {/* Bottom-left neighborhood + name */}
        <div className="absolute inset-x-5 bottom-5">
          <div className="overline mb-2 flex items-center gap-2">
            <span>{venue.neighborhood}</span>
            {venue.cuisine && (
              <>
                <span className="text-[#6B6560]">·</span>
                <span>{venue.cuisine}</span>
              </>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-serif-display text-3xl leading-tight text-[#F2EDE7]">
              {venue.name}
            </h3>
            <span className="text-[#CE6A4A] font-serif text-sm tracking-widest">
              {priceStr}
            </span>
          </div>
        </div>
      </div>

      {topOffering && (
        <div className="px-5 py-4 hairline-t flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="overline mb-1">What regulars order</div>
            <div className="text-sm text-[#F2EDE7]/85 font-light truncate">
              {topOffering}
            </div>
          </div>
          {venue.chef && (
            <div className="text-right shrink-0">
              <div className="overline mb-1">Chef</div>
              <div className="text-sm text-[#F2EDE7]/85 font-serif whitespace-nowrap">
                {venue.chef.split(" ")[0]}
              </div>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
