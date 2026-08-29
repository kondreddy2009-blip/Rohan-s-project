import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  Quiet: { dot: "bg-[#7A9B7A]", label: "Quiet" },
  "Filling In": { dot: "bg-[#C2A36B]", label: "Filling in" },
  "At Capacity": { dot: "bg-[#B39586]", label: "At Capacity" },
};

export function StatusIndicator({ status, className, showLabel = true, testId }) {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.Quiet;
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      data-testid={testId}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full status-dot-pulse", cfg.dot)}
      />
      {showLabel && (
        <span className="overline text-[#B39586]">{cfg.label}</span>
      )}
    </div>
  );
}
