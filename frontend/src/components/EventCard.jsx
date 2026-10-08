import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatEventWhen, partnerImage, useToggleRsvp } from "@/lib/partnersService";
import { meetsTier, pointsToTier, tierLabel, tierRequirementPhrase } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function EventCard({ event, partner, className }) {
  const { user } = useAuth();
  const rsvp = useToggleRsvp();
  const locked = !meetsTier(user?.tier, event.tier_required);
  const seatsLeft = event.seats ? event.seats - event.rsvp_count : null;
  const badge = locked ? "Locked" : event.tier_required ? tierLabel(event.tier_required) : "Open";
  const meta = [event.seats && `${event.seats} seats`, tierRequirementPhrase(event.tier_required)]
    .filter(Boolean)
    .join(" · ");

  const onRsvp = () =>
    rsvp.mutate(event.id, {
      onSuccess: (e) => toast.success(e.rsvped ? `You're on the list for ${event.title}.` : "RSVP cancelled."),
      onError: (err) => toast.error(formatApiError(err.response?.data?.detail)),
    });

  let action;
  if (locked) {
    const away = pointsToTier(user?.lifetime_points, event.tier_required);
    action = (
      <span className="tbl-pill tbl-pill--muted tbl-pill--lg" aria-disabled="true">
        {away.toLocaleString("en-IN")} pts away
      </span>
    );
  } else if (event.rsvped) {
    action = (
      <button type="button" onClick={onRsvp} disabled={rsvp.isPending} className="tbl-above tbl-pill tbl-pill--tint tbl-pill--lg" aria-label={`Cancel RSVP for ${event.title}`}>
        Going
      </button>
    );
  } else if (seatsLeft !== null && seatsLeft <= 0) {
    action = (
      <button type="button" disabled className="tbl-pill tbl-pill--lg">
        Full
      </button>
    );
  } else {
    action = (
      <button type="button" onClick={onRsvp} disabled={rsvp.isPending} className="tbl-above tbl-pill tbl-pill--accent tbl-pill--lg" data-testid={`rsvp-${event.id}`}>
        RSVP
      </button>
    );
  }

  return (
    <article className={cn("tbl-card tbl-card--lift flex flex-col", className)} data-testid={`event-card-${event.id}`}>
      <div className="relative h-[150px] bg-ritual-surface-2">
        <img
          src={partnerImage(partner?.image_url)}
          alt=""
          loading="lazy"
          className={cn("tbl-media", locked && "opacity-40 grayscale")}
        />
        <div className="tbl-scrim" />
        <span className="absolute right-3 top-3 tbl-pill tbl-pill--glass tbl-pill--sm" data-testid="event-tier-badge">
          {badge}
        </span>
        <div className="absolute inset-x-4 bottom-3.5">
          <div className="text-[12px] font-bold">{formatEventWhen(event)}</div>
          <h3 className="mt-0.5 text-[16px] font-extrabold leading-tight tracking-[-0.01em]">
            <Link to={`/restaurant/${partner?.slug}`} className="tbl-stretched">
              {event.title}
            </Link>
          </h3>
        </div>
      </div>
      <div className="tbl-footer-strip flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[12px] text-ritual-muted">{meta}</span>
        {action}
      </div>
    </article>
  );
}
