import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  Quiet: { dot: "bg-[#7A9B7A]", label: "Quiet" },
  "Filling In": { dot: "bg-[#F4764F]", label: "Filling in" },
  "At Capacity": { dot: "bg-[#8E8982]", label: "At Capacity" },
};

const AVAILABILITY_STYLES = {
  fully_booked: { dot: "bg-[#C08B70]", label: "Fully booked" },
  closed: { dot: "bg-[#6B665F]", label: "Closed for the night" },
};

export function queueLabel(queueLength) {
  if (queueLength == null) return null;
  if (queueLength <= 0) return "No wait";
  return `${queueLength} ${queueLength === 1 ? "party" : "parties"} waiting`;
}

export function StatusIndicator({
  status,
  queueLength,
  waitMinutes,
  availability,
  className,
  showLabel = true,
  testId,
}) {
  const availabilityCfg = AVAILABILITY_STYLES[availability];
  const cfg = availabilityCfg || STATUS_STYLES[status] || STATUS_STYLES.Quiet;
  const queue = queueLabel(queueLength);
  const wait = waitMinutes != null && waitMinutes > 0 ? `~${waitMinutes} min` : null;
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      data-testid={testId}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full status-dot-pulse", cfg.dot)}
      />
      {showLabel && (
        <span className="overline text-[#8E8982]">{cfg.label}</span>
      )}
      {showLabel && !availabilityCfg && queue && (
        <span className="overline text-[#6B665F]" data-testid={testId ? `${testId}-queue` : undefined}>
          · {queue}
          {wait ? ` · ${wait}` : ""}
        </span>
      )}
    </div>
  );
}
