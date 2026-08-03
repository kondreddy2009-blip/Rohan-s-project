import { cn } from "@/lib/utils";

export function TierBadge({ tier, className, testId }) {
  if (!tier) return null;
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 border border-[#C2A36B]/40 px-2.5 py-1",
        "overline text-[#C2A36B]",
        className,
      )}
    >
      <span className="h-1 w-1 bg-[#C2A36B]" />
      {tier}
    </span>
  );
}
