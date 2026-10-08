import { partnersVisited, useWallet } from "@/lib/member";
import { tierLabel } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function TierCard({ className }) {
  const { data: wallet } = useWallet();
  if (!wallet) {
    return <div className={cn("tbl-tier h-[178px] opacity-60", className)} aria-busy="true" />;
  }
  const visited = partnersVisited(wallet);
  return (
    <div className={cn("tbl-tier p-6", className)} data-testid="tier-card">
      <div className="tbl-eyebrow">Table tier</div>
      <div className="mt-1 flex items-end justify-between gap-4">
        <div className="text-[40px] leading-none font-extrabold tracking-[-0.03em]" data-testid="tier-card-tier">
          {tierLabel(wallet.tier)}
        </div>
        <div className="text-right text-[13px] font-bold leading-snug">
          <div>{wallet.balance.toLocaleString("en-IN")} pts</div>
          <div>
            {visited} {visited === 1 ? "partner" : "partners"}
          </div>
        </div>
      </div>
      <div
        className="tbl-progress mt-5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={wallet.progress_percent}
        aria-label={wallet.next_tier ? `Progress to ${tierLabel(wallet.next_tier)}` : "Top tier reached"}
      >
        <span style={{ width: `${wallet.progress_percent}%` }} />
      </div>
      <div className="mt-3 text-[13px] font-bold">
        {wallet.next_tier
          ? `${wallet.points_to_next.toLocaleString("en-IN")} more points for ${tierLabel(wallet.next_tier)}`
          : "You're at the top tier."}
      </div>
    </div>
  );
}
