import { partnerStatus } from "@/lib/partnersService";
import { cn } from "@/lib/utils";

export function StatusDot({ tone, className }) {
  return <span className={cn("tbl-dot", `tbl-dot--${tone}`, className)} aria-hidden="true" />;
}

/** Translucent pill for use over photos: dot + "Quiet · seat now" / "18 min" / "Full". */
export function StatusPill({ partner, long = false, className }) {
  const s = partnerStatus(partner);
  return (
    <span className={cn("tbl-pill tbl-pill--glass", className)} data-testid="status-pill">
      <StatusDot tone={s.tone} />
      {long ? s.long : s.short}
    </span>
  );
}
