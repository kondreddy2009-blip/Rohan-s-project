import { Link } from "react-router-dom";
import { StatusPill } from "@/components/StatusPill";
import { partnerImage } from "@/lib/partnersService";
import { cn } from "@/lib/utils";

function hideBrokenImage(e) {
  e.currentTarget.style.visibility = "hidden";
}

function PartnerChips({ partner, showPoints }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {showPoints && (
        <span className="tbl-pill tbl-pill--tint-solid" data-testid="chip-points-per-visit">
          {partner.points_per_visit} pts per visit
        </span>
      )}
      {partner.double_points_tonight && <span className="tbl-pill tbl-pill--tint-solid">2× points tonight</span>}
      {partner.chefs_pick && <span className="tbl-pill tbl-pill--glass">Chef&apos;s pick</span>}
    </div>
  );
}

/**
 * variant="hero": tall photo card with status/distance pills, title block and a
 *   "Most re-ordered" + "Hold table" footer strip. Used on Discover and as the
 *   restaurant page header (link={false}, showPoints).
 * variant="tile": compact grid card.
 */
export function RestaurantCard({
  partner,
  variant = "tile",
  link = true,
  showPoints = false,
  onHold,
  className,
  overlay,
}) {
  const href = `/restaurant/${partner.slug}`;
  const title = link ? (
    <Link to={href} className="tbl-stretched">
      {partner.name}
    </Link>
  ) : (
    partner.name
  );

  if (variant === "tile") {
    return (
      <article className={cn("tbl-card tbl-card--lift", className)} data-testid={`grid-card-${partner.slug}`}>
        <div className="relative h-[115px] bg-ritual-surface-2">
          <img
            src={partnerImage(partner.image_url)}
            alt=""
            loading="lazy"
            onError={hideBrokenImage}
            className="tbl-media"
          />
          <div className="absolute left-2.5 top-2.5">
            <StatusPill partner={partner} />
          </div>
        </div>
        <div className="px-3.5 pt-3 pb-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[14px] font-bold truncate">{title}</h3>
            <span className="text-[12px] font-bold text-ritual-accent whitespace-nowrap">
              {partner.points_per_visit} pts
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-ritual-muted truncate">
            {partner.area} · {partner.cuisine}
          </div>
        </div>
      </article>
    );
  }

  const reordered = partner.most_reordered || [];
  return (
    <article
      className={cn("tbl-card flex flex-col", link && "tbl-card--lift", className)}
      data-testid={`hero-card-${partner.slug}`}
    >
      <div className="relative flex-1 min-h-[240px] bg-ritual-surface-2">
        <img src={partnerImage(partner.image_url)} alt="" onError={hideBrokenImage} className="tbl-media" />
        <div className="tbl-scrim" />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <StatusPill partner={partner} long />
          {partner.distance_km != null && (
            <span className="tbl-pill tbl-pill--glass">{partner.distance_km} km</span>
          )}
        </div>
        <div className="absolute inset-x-5 bottom-5 desk:inset-x-7 desk:bottom-6">
          <div className="text-[13px] font-semibold text-ritual-text opacity-80">
            {partner.area} · {partner.cuisine}
          </div>
          <h3 className="mt-1 text-[28px] desk:text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {title}
          </h3>
          <PartnerChips partner={partner} showPoints={showPoints} />
        </div>
        {overlay}
      </div>
      <div className="tbl-footer-strip flex items-center justify-between gap-4 px-5 py-4 desk:px-7">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-ritual-muted">Most re-ordered</div>
          <div className="text-[15px] font-bold truncate">
            {reordered.length ? reordered.slice(0, 2).join(" · ") : "New on Table"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onHold?.(partner)}
          className="tbl-above tbl-pill tbl-pill--accent tbl-pill--lg"
          data-testid="hold-table-button"
        >
          Hold table
        </button>
      </div>
    </article>
  );
}
