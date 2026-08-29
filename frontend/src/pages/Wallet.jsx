import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { api } from "@/lib/api";
import { TierBadge } from "@/components/TierBadge";
import { useAuth } from "@/lib/auth-context";

function LedgerRow({ item }) {
  const isEarn = item.type === "earn";
  return (
    <div
      className="flex items-center justify-between gap-4 py-5 border-b border-white/[0.05]"
      data-testid={`ledger-${item.id}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-8 w-8 flex-shrink-0 border border-[#253453] flex items-center justify-center">
          {isEarn ? (
            <ArrowUpRight strokeWidth={1.2} className="h-3.5 w-3.5 text-[#C2A36B]" />
          ) : (
            <ArrowDownLeft strokeWidth={1.2} className="h-3.5 w-3.5 text-[#E8ECF5]" />
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
          isEarn ? "text-[#C2A36B]" : "text-[#E8ECF5]"
        }`}
      >
        {isEarn ? "+" : ""}
        {item.points_delta}
      </div>
    </div>
  );
}

export default function Wallet() {
  const { user, refresh } = useAuth();
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

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14" data-testid="wallet-page">
      <div className="flex items-start justify-between gap-4 animate-fade-up">
        <div>
          <div className="overline">Nocturne Wallet</div>
          <h1 className="font-serif-display text-3xl sm:text-4xl mt-2">
            {user?.name?.split(" ")[0]}&apos;s balance
          </h1>
        </div>
        <TierBadge tier={wallet.tier} testId="wallet-tier-badge" />
      </div>

      {/* Balance card */}
      <div className="mt-10 animate-fade-up delay-100">
        <div className="overline mb-4">Nocturne Points</div>
        <div
          className="font-serif-display text-8xl sm:text-9xl leading-none text-[#E8ECF5] tabular-nums"
          data-testid="wallet-balance"
        >
          {wallet.balance.toLocaleString()}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-6 max-w-md">
          <div>
            <div className="overline mb-1">Lifetime</div>
            <div className="font-serif text-xl">{wallet.lifetime_points.toLocaleString()}</div>
          </div>
          <div>
            <div className="overline mb-1">Visits</div>
            <div className="font-serif text-xl">{wallet.visits}</div>
          </div>
          <div>
            <div className="overline mb-1">Tier</div>
            <div className="font-serif text-xl">{wallet.tier}</div>
          </div>
        </div>
      </div>

      <div className="mt-10 animate-fade-up delay-200">
        <Link
          to="/redeem"
          data-testid="wallet-redeem-button"
          className="btn-primary inline-block"
        >
          Redeem at any room
        </Link>
      </div>

      {/* Redemptions */}
      {redemptions.length > 0 && (
        <div className="mt-16 animate-fade-up">
          <div className="overline mb-6">Held in reserve</div>
          <div className="space-y-4">
            {redemptions.filter((r) => !r.redeemed).slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="p-5 border border-[#C2A36B]/30 bg-[#121D33]"
                data-testid={`redemption-${r.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="overline-accent mb-1.5">
                      {r.venue_name}
                    </div>
                    <div className="font-serif-display text-2xl">{r.perk_name}</div>
                    <div className="text-sm text-[#8996B0] mt-1 font-light">
                      {r.perk_description}
                    </div>
                  </div>
                  <div className="font-mono text-xs tracking-widest text-[#C2A36B] whitespace-nowrap">
                    {r.code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="mt-16 animate-fade-up">
        <div className="overline mb-4">Ledger</div>
        <div>
          {wallet.ledger.length === 0 ? (
            <div className="text-[#8996B0] font-light py-8">
              Your ledger will fill as you visit the rooms.
            </div>
          ) : (
            wallet.ledger.map((entry) => <LedgerRow key={entry.id} item={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}
