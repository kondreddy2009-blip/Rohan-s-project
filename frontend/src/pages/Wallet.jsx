import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownLeft, ArrowRight, ChevronRight, Gift, MapPin } from "lucide-react";
import { api, assetUrl } from "@/lib/api";
import { TierBadge } from "@/components/TierBadge";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const serif = "font-['Cormorant_Garamond']";
const card = "rounded-3xl border border-white/10 bg-[#141312]/90";

const PERKS = [
  { cost: 250, name: "Priority Seating" },
  { cost: 500, name: "Complimentary Signature" },
  { cost: 750, name: "Early Access Booking" },
  { cost: 1000, name: "Inner Circle Experience" },
];

const STEPS = [
  { t: "Earn", d: "Dining rewards at partner venues." },
  { t: "Track", d: "Each restaurant's balance in one place." },
  { t: "Redeem", d: "Points at the venue where you earned them." },
];

function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8A27F]">
      {children}
      <span className="h-px w-12 bg-[#E8A27F]/60" />
    </div>
  );
}

function LedgerRow({ item }) {
  const isEarn = item.type === "earn";
  return (
    <div
      className="flex items-center justify-between gap-4 py-5 border-b border-white/[0.05]"
      data-testid={`ledger-${item.id}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-8 w-8 flex-shrink-0 border border-[#262321] flex items-center justify-center">
          {isEarn ? (
            <ArrowUpRight strokeWidth={1.2} className="h-3.5 w-3.5 text-[#CE6A4A]" />
          ) : (
            <ArrowDownLeft strokeWidth={1.2} className="h-3.5 w-3.5 text-[#F2EDE7]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-serif text-lg truncate">{item.description}</div>
          <div className="overline mt-0.5">
            {new Date(item.timestamp).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}{" "}
            · {item.venue_name}
          </div>
        </div>
      </div>
      <div
        className={`font-serif-display text-2xl tabular-nums ${
          isEarn ? "text-[#CE6A4A]" : "text-[#F2EDE7]"
        }`}
      >
        {isEarn ? "+" : ""}
        {item.points_delta}
      </div>
    </div>
  );
}

export default function Wallet() {
  const { refresh } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [w, r] = await Promise.all([
        api.get("/wallet"),
        api.get("/wallet/redemptions"),
      ]);
      setWallet(w.data);
      setRedemptions(r.data);
      await refresh();
    } catch {
      /* 401s are handled globally (redirect to login); other errors leave the loader */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !wallet) {
    return <div className="mx-auto max-w-3xl px-5 py-16 overline text-center">Loading wallet…</div>;
  }

  const top = wallet.venues?.[0];
  const topBalance = top?.balance || 0;
  const nextPerk = PERKS.find((p) => topBalance < p.cost);
  const progress = nextPerk ? Math.min(100, (topBalance / nextPerk.cost) * 100) : 100;

  return (
    <div className="relative px-5 sm:px-10 lg:px-16 pb-14" data-testid="wallet-page">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_at_85%_0%,rgba(232,162,127,0.18),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-[1280px]">
        <div className="flex items-start justify-between gap-4 pt-4">
          <div>
            <Eyebrow>Table Wallet</Eyebrow>
            <h1 className={cn(serif, "mt-4 text-5xl sm:text-6xl font-semibold tracking-[-0.01em] text-[#F2EDE7]")}>
              Your rewards, <span className="text-[#CE6A4A]">at a glance</span>
            </h1>
            <p className="mt-2 text-lg text-[#B8AA98]">Points earned across your dining experiences.</p>
          </div>
          <TierBadge tier={wallet.tier} testId="wallet-tier-badge" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* Left column */}
          <div className="space-y-10">
            <section
              className={cn(card, "relative overflow-hidden p-8 sm:p-10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(206,106,74,0.10),transparent_55%)]")}
              data-testid="wallet-balance-section"
            >
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#B8AA98]">Available points</div>
              <div data-testid="wallet-balance" className="mt-3">
                <AnimatedNumber
                  value={wallet.balance}
                  className={cn(serif, "block text-8xl sm:text-9xl font-semibold leading-none tabular-nums text-[#F6E3DA]")}
                />
              </div>
              <p className="mt-3 text-xl text-[#F2EDE7]">
                {top ? `Ready to redeem at ${top.venue_name}` : "Check in at a restaurant to start earning"}
              </p>
              <div className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="h-full rounded-full bg-gradient-to-r from-[#CE6A4A] to-[#F0A878]" style={{ width: `${progress}%` }} />
              </div>
              {nextPerk && (
                <p className="mt-3 text-sm text-[#B8AA98]">
                  {nextPerk.cost - topBalance} more{top ? ` at ${top.venue_name}` : ""} to unlock{" "}
                  <span className="text-[#CE6A4A]">{nextPerk.name}</span>
                </p>
              )}

              <div className="pointer-events-none absolute right-8 top-10 hidden h-44 w-72 rotate-[-8deg] rounded-2xl border border-[#CE6A4A]/30 bg-gradient-to-br from-[#262321] to-[#0E0D0C] shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:grid place-items-center">
                <div className="flex flex-col items-center gap-2">
                  <img src="/logo.png" alt="" className="h-14 w-auto" />
                  <img src="/wordmark.png" alt="" className="w-28 h-auto" />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6 max-w-xl">
                {[
                  { v: <AnimatedNumber value={wallet.lifetime_points} />, l: "Lifetime points" },
                  { v: wallet.visits, l: "Visits" },
                  { v: wallet.tier, l: "Tier" },
                ].map((m, i) => (
                  <div key={m.l} className={i === 0 ? "pr-4" : "px-4"}>
                    <div className={cn(serif, "text-2xl font-semibold text-[#F2EDE7]")}>{m.v}</div>
                    <div className="mt-0.5 text-sm text-[#B8AA98]">{m.l}</div>
                  </div>
                ))}
              </div>
            </section>

            <section data-testid="wallet-venue-balances">
              <h2 className={cn(serif, "text-4xl font-semibold text-[#F2EDE7]")}>Points by restaurant</h2>
              <p className="mt-1 text-[15px] text-[#B8AA98]">
                Your points balance at each partner venue. Points can only be redeemed where you earned them.
              </p>
              {wallet.venues?.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {wallet.venues.map((v) => (
                    <div
                      key={v.venue_id}
                      className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[#141312]/90 p-3 pr-5"
                      data-testid={`wallet-venue-${v.venue_id}`}
                    >
                      {v.image_url && (
                        <img src={assetUrl(v.image_url)} alt="" className="h-[84px] w-[84px] shrink-0 rounded-xl object-cover" loading="lazy" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={cn(serif, "truncate text-2xl font-semibold text-[#F2EDE7]")}>{v.venue_name}</div>
                        {v.neighborhood && (
                          <div className="mt-1 flex items-center gap-1.5 truncate text-sm text-[#B8AA98]">
                            <MapPin className="h-3.5 w-3.5 text-[#E8A27F]" />
                            {v.neighborhood}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl tabular-nums text-[#F2EDE7]">
                        <span className="font-semibold">{v.balance.toLocaleString("en-IN")}</span>{" "}
                        <span className="text-lg text-[#B8AA98]">pts</span>
                      </div>
                      <Link
                        to={`/redeem?venue=${v.venue_id}`}
                        data-testid={`wallet-redeem-${v.venue_id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#CE6A4A]/60 px-5 py-2.5 text-sm font-semibold text-[#EE9B79] transition-colors hover:border-[#CE6A4A] hover:text-white"
                      >
                        Redeem here <ArrowRight className="h-4 w-4" />
                      </Link>
                      <ChevronRight className="hidden h-4 w-4 text-[#8F8781] sm:block" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 text-[#B8AA98]">Check in at a restaurant to start earning points there.</div>
              )}
              <Link
                to="/redeem"
                data-testid="wallet-redeem-button"
                className="mt-6 inline-flex items-center rounded-full bg-[#F07F5E] px-7 py-3.5 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F59273]"
              >
                Redeem your points
              </Link>
            </section>
          </div>

          {/* Right column */}
          <aside className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#C8694B] via-[#B95A3E] to-[#8F3F2B] p-7 text-[#FFF1E6]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFD9C2]/80">Make the most of your points</div>
              <h2 className={cn(serif, "mt-3 max-w-[12ch] text-4xl font-semibold leading-[1.05]")}>Make your next visit count</h2>
              <p className="mt-3 max-w-[22ch] text-[15px] text-[#FFE3D2]/90">Use your points at the restaurant where you earned them.</p>
              <Link
                to="/discover"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#F58A68] px-6 py-3 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F9A084]"
              >
                Explore restaurants <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="absolute right-6 top-1/2 grid h-24 w-24 -translate-y-1/2 place-items-center rounded-full bg-black/25 ring-1 ring-white/20">
                <Gift strokeWidth={1.4} className="h-10 w-10 text-[#F4D9B8]" />
              </span>
            </div>

            <div className={cn(card, "p-7")}>
              <h2 className={cn(serif, "text-3xl font-semibold text-[#F2EDE7]")}>How points work</h2>
              <p className="mt-1 text-[15px] text-[#B8AA98]">Simple, seamless, and exclusive.</p>
              <ol className="mt-5">
                {STEPS.map((st, i) => (
                  <li key={st.t} className={cn("flex items-center gap-4 py-4", i > 0 && "border-t border-white/10")}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#CE6A4A]/70 text-[#EE9B79]">{i + 1}</span>
                    <div>
                      <div className="font-medium text-[#F2EDE7]">{st.t}</div>
                      <div className="text-sm text-[#B8AA98]">{st.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        {/* Redemptions */}
        {redemptions.filter((r) => !r.redeemed).length > 0 && (
          <section className="mt-12">
            <h2 className={cn(serif, "text-4xl font-semibold text-[#F2EDE7]")}>Held in reserve</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {redemptions.filter((r) => !r.redeemed).slice(0, 3).map((r) => (
                <div key={r.id} className="rounded-2xl border border-[#CE6A4A]/30 bg-[#1B1917] p-5" data-testid={`redemption-${r.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E8A27F]">{r.venue_name}</div>
                      <div className={cn(serif, "mt-1 text-2xl font-semibold text-[#F2EDE7]")}>{r.perk_name}</div>
                      <div className="mt-1 text-sm text-[#B8AA98]">{r.perk_description}</div>
                    </div>
                    <div className="font-mono text-xs tracking-widest text-[#CE6A4A] whitespace-nowrap">{r.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ledger */}
        <section className="mt-12">
          <h2 className={cn(serif, "text-4xl font-semibold text-[#F2EDE7]")}>Ledger</h2>
          <div className="mt-3 max-w-3xl">
            {wallet.ledger.length === 0 ? (
              <div className="py-8 text-[#B8AA98]">Your ledger will fill as you visit the rooms.</div>
            ) : (
              wallet.ledger.map((entry) => <LedgerRow key={entry.id} item={entry} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
