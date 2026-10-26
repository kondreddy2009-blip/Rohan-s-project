import { Link } from "react-router-dom";
import { assetUrl } from "@/lib/api";
import { StatusIndicator } from "@/components/StatusIndicator";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

const VIBE_COLORS = {
  "Chef's Pick": "bg-[#CE6A4A]/12 text-[#CE6A4A] border-[#CE6A4A]/40",
  "Insider Access": "bg-[#CE6A4A]/12 text-[#CE6A4A] border-[#CE6A4A]/40",
  "Date Night": "bg-[#EE9B79]/15 text-[#E29B87] border-[#EE9B79]/40",
  Buzzing: "bg-[#EE9B79]/15 text-[#E29B87] border-[#EE9B79]/40",
  "Just Opened": "bg-[#E27D8B]/15 text-[#E2A0B6] border-[#E27D8B]/40",
  "Solo-Friendly": "bg-[#89A88C]/15 text-[#A6C4A9] border-[#89A88C]/40",
  "Neighborhood Favorite": "bg-[#89A88C]/15 text-[#A6C4A9] border-[#89A88C]/40",
  "Group-Friendly": "bg-[#E8A06E]/15 text-[#E2C79B] border-[#E8A06E]/40",
};

export function VibePill({ vibe, className = "" }) {
  const color = VIBE_COLORS[vibe] || "bg-white/5 text-white/70 border-white/15";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 border text-[9.5px] font-medium tracking-[0.16em] uppercase whitespace-nowrap ${color} ${className}`}
      data-testid={`vibe-${vibe.replace(/[^a-z]+/gi, "-").toLowerCase()}`}
    >
      {vibe}
    </span>
  );
}

export function VenueCard({ venue, index = 0 }) {
  const topOffering = venue.signature_offerings?.[0]?.name;
  const vibes = venue.vibes || [];
  const primaryVibe = vibes[0];
  const [ref, visible] = useReveal();

  return (
    <Link
      ref={ref}
      to={`/venues/${venue.id}`}
      className={cn("group block card-invite reveal", visible && "is-visible")}
      style={{ transitionDelay: visible ? `${Math.min(index * 80, 400)}ms` : "0ms" }}
      data-testid={`venue-card-${venue.id}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={assetUrl(venue.image_url)}
          alt={venue.name}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A0A] via-[#0B0A0A]/20 to-transparent" />

        {/* Top-left status */}
        <div className="absolute left-5 top-5">
          <StatusIndicator
            status={venue.status}
            queueLength={venue.queue_length}
            waitMinutes={venue.wait_minutes}
            availability={venue.availability}
          />
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
              <div className="text-sm text-[#F2EDE7]/85 font-serif italic whitespace-nowrap">
                {venue.chef.split(" ")[0]}
              </div>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
