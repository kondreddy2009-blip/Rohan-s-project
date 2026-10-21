import { Link } from "react-router-dom";
import { RatingBadge } from "@/components/Reviews";

export function fillingFastStatus(venue) {
  if (venue.availability === "fully_booked" || venue.status === "At Capacity") {
    return { label: "Full", dot: "bg-[#E27D60]" };
  }
  if (venue.wait_minutes && venue.wait_minutes > 0) {
    return { label: `${venue.wait_minutes} min`, dot: "bg-[#E8A33D]" };
  }
  return { label: "Seat now", dot: "bg-[#7DBE8A]" };
}

export function FillingFastCard({ venue }) {
  const { label, dot } = fillingFastStatus(venue);
  const points = venue.loyalty_points_per_checkin;

  return (
    <Link
      to={`/venues/${venue.id}`}
      className="group block rounded-2xl bg-[#1F1D1B] overflow-hidden"
      data-testid={`filling-fast-${venue.id}`}
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={venue.image_url}
          alt={venue.name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </div>
      </div>
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-[15px] text-white truncate">{venue.name}</h3>
          {points > 0 && (
            <span className="text-[#E27D60] text-xs font-bold whitespace-nowrap shrink-0">
              {points} pts
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-[#8E8982] truncate">
          {venue.neighborhood}
          {venue.cuisine ? ` · ${venue.cuisine}` : ""}
        </div>
        {venue.rating_count > 0 && (
          <RatingBadge avg={venue.rating_avg} count={venue.rating_count} className="mt-1.5 text-xs text-[#E8A33D]" />
        )}
      </div>
    </Link>
  );
}
