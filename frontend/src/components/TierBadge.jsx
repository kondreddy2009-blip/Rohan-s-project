import { cn } from "@/lib/utils";
import { tierLabel } from "@/lib/tiers";

export function TierBadge({ tier, className, testId }) {
  if (!tier) return null;
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[#CE6A4A]/14 px-3 py-1.5",
        "text-[11px] font-bold tracking-normal text-[#EE9B79]",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#CE6A4A]" />
      {tierLabel(tier)}
    </span>
  );
}
