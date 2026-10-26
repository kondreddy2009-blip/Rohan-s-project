import { useState } from "react";
import { assetUrl } from "@/lib/api";
import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";

export function fillingFastStatus(venue) {
  if (venue.availability === "fully_booked" || venue.status === "At Capacity") {
    return { label: "Full", dot: "bg-[#EE9B79]" };
  }
  if (venue.wait_minutes && venue.wait_minutes > 0) {
    return { label: `${venue.wait_minutes} min`, dot: "bg-[#E8A33D]" };
  }
  return { label: "Seat now", dot: "bg-[#7DBE8A]" };
}

export function FillingFastCard({ venue }) {
  const { label, dot } = fillingFastStatus(venue);
  const points = venue.loyalty_points_per_checkin;
  const [liked, setLiked] = useState(false);

  return (
    <Link
      to={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#141312]"
      data-testid={`filling-fast-${venue.id}`}
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={assetUrl(venue.image_url)}
          alt={venue.name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3.5 py-1.5 text-[13px] font-semibold text-white">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </div>
        <button
          type="button"
          aria-label={liked ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={liked}
          onClick={(e) => {
            e.preventDefault();
            setLiked((v) => !v);
          }}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-sm text-white hover:bg-black/75 transition-colors"
        >
          <Heart className={liked ? "h-5 w-5 fill-[#F07F5E] text-[#F07F5E]" : "h-5 w-5"} strokeWidth={1.6} />
        </button>
      </div>
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-['Cormorant_Garamond'] text-[26px] font-semibold leading-tight text-white truncate">{venue.name}</h3>
          {venue.rating_count > 0 && (
            <span className="flex shrink-0 items-center gap-1 pt-1.5 text-[14px] font-medium text-white">
              <Star className="h-4 w-4 fill-[#E8A33D] text-[#E8A33D]" />
              {Number(venue.rating_avg).toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="min-w-0 truncate text-[13px] text-[#9C8F7E]">
            {venue.neighborhood}
            {venue.cuisine ? ` · ${venue.cuisine}` : ""}
          </div>
          {points > 0 && (
            <span className="shrink-0 rounded-full bg-[#4A2A20] px-3.5 py-1.5 text-[13px] font-semibold text-[#F0A58C]">
              {points} pts
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
