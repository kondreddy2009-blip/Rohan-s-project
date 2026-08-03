import { Link } from "react-router-dom";
import { StatusIndicator } from "@/components/StatusIndicator";

export function VenueCard({ venue, index = 0 }) {
  const topOffering = venue.signature_offerings?.[0]?.name;
  const secondOffering = venue.signature_offerings?.[1]?.name;
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
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/20 to-transparent" />
        <div className="absolute left-5 top-5">
          <StatusIndicator status={venue.status} />
        </div>
        <div className="absolute right-5 top-5 overline text-[#F4F4EE]/70">
          {venue.type}
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <div className="overline mb-2">{venue.neighborhood}</div>
          <h3 className="font-serif-display text-3xl leading-tight text-[#F4F4EE]">
            {venue.name}
          </h3>
        </div>
      </div>
      {(topOffering || secondOffering) && (
        <div className="px-5 py-4 hairline-t">
          <div className="overline mb-1.5">What regulars order</div>
          <div className="text-sm text-[#F4F4EE]/85 font-light">
            {[topOffering, secondOffering].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
    </Link>
  );
}
