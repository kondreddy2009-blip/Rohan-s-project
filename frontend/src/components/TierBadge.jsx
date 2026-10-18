import { cn } from "@/lib/utils";

export function TierBadge({ tier, className, testId }) {
  if (!tier) return null;
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 border border-[#F4764F]/40 px-2.5 py-1",
        "overline text-[#F4764F]",
        className,
      )}
    >
      <span className="h-1 w-1 bg-[#F4764F]" />
      {tier}
    </span>
  );
}
