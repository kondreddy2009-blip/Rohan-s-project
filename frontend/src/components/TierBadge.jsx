import { cn } from "@/lib/utils";

export function TierBadge({ tier, className, testId }) {
  if (!tier) return null;
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 border border-[#E8C9A0]/40 px-2.5 py-1",
        "overline text-[#E8C9A0]",
        className,
      )}
    >
      <span className="h-1 w-1 bg-[#E8C9A0]" />
      {tier}
    </span>
  );
}
