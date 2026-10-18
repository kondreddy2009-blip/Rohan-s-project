import { Link, useNavigate } from "react-router-dom";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

function formatEventWhen(dateStr, time) {
  const d = new Date(`${dateStr}T${time || "00:00"}`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const hour = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: d.getMinutes() ? "2-digit" : undefined,
    hour12: true,
  });
  return `${day} ${date} · ${hour}`;
}

export function EventCard({ event, userTier, pointsAway }) {
  const required = event.tier_required;
  const userIdx = TIER_ORDER.indexOf(userTier || "Guest");
  const requiredIdx = required ? TIER_ORDER.indexOf(required) : -1;
  const locked = requiredIdx > userIdx;
  const navigate = useNavigate();
  const openVenue = () => navigate(`/venues/${event.venue_id}`);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openVenue}
      onKeyDown={(e) => e.key === "Enter" && openVenue()}
      className="rounded-2xl bg-[#1F1D1B] overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-0.5"
      data-testid={`event-card-${event.id}`}>
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={event.venue_image_url}
          alt={event.venue_name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {required && (
          <span
            className={
              "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.14em] uppercase " +
              (locked ? "bg-black/55 text-[#B8B2AA]" : "bg-[#D8694A] text-[#1A0F0B]")
            }
          >
            {locked ? "Locked" : required}
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3">
          <div className="text-xs font-semibold text-white/80">
            {formatEventWhen(event.date, event.time)}
          </div>
          <h3 className="mt-0.5 text-lg font-bold text-white leading-tight">{event.title}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="text-xs text-[#8E8982]">
          {event.capacity ? `${event.capacity} seats · ` : ""}
          {required ? (locked ? `${required} only` : `${required} and above`) : "Open to all"}
        </div>
        {locked ? (
          <span className="rounded-full bg-[#2A2826] px-3.5 py-2 text-xs font-bold text-[#B8B2AA] whitespace-nowrap shrink-0">
            {pointsAway > 0 ? `${pointsAway.toLocaleString("en-IN")} pts away` : `Requires ${required}`}
          </span>
        ) : (
          <Link
            to={`/venues/${event.venue_id}`}
            data-testid={`event-rsvp-${event.id}`}
            className="rounded-full bg-[#D8694A] px-4 py-2 text-xs font-extrabold text-[#1A0F0B] hover:bg-[#E27D60] transition-colors whitespace-nowrap shrink-0"
          >
            RSVP
          </Link>
        )}
      </div>
    </div>
  );
}
