import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Sparkles } from "@/components/Sparkles";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

export default function Redeem() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [perks, setPerks] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedPerk, setSelectedPerk] = useState(null);
  const [step, setStep] = useState("venue"); // venue → perk → confirm → done
  const [busy, setBusy] = useState(false);
  const [redemption, setRedemption] = useState(null);

  useEffect(() => {
    async function load() {
      const [v, p] = await Promise.all([api.get("/venues"), api.get("/perks")]);
      setVenues(v.data);
      setPerks(p.data);
    }
    load();
  }, []);

  const userTierIdx = TIER_ORDER.indexOf(user?.tier || "Guest");
  const balance = user?.ritual_points_balance || 0;

  const affordablePerks = useMemo(
    () =>
      perks.map((p) => {
        const perkTierIdx = TIER_ORDER.indexOf(p.tier_required);
        return {
          ...p,
          affordable: balance >= p.cost,
          tier_ok: userTierIdx >= perkTierIdx,
        };
      }),
    [perks, balance, userTierIdx],
  );

  const submit = async () => {
    if (!selectedVenue || !selectedPerk) return;
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/redeem", {
        venue_id: selectedVenue.id,
        perk_code: selectedPerk.code,
      });
      setRedemption(data.redemption);
      await refresh();
      setStep("done");
      toast.success("A perk has been reserved for you.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not redeem right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 sm:py-14" data-testid="redeem-page">
      <div className="overline">Redeem</div>
      <h1 className="font-serif-display text-4xl sm:text-5xl mt-2">
        {step === "done"
          ? "Held in reserve for you."
          : step === "venue"
            ? "Choose a room."
            : step === "perk"
              ? "Choose a perk."
              : "A quiet confirmation."}
      </h1>

      {/* Steps indicator */}
      <div className="mt-6 flex items-center gap-3 overline">
        <span className={step === "venue" ? "text-[#C2A36B]" : ""}>01 · Room</span>
        <span className="text-[#7A5C55]">/</span>
        <span className={step === "perk" ? "text-[#C2A36B]" : ""}>02 · Perk</span>
        <span className="text-[#7A5C55]">/</span>
        <span className={step === "confirm" || step === "done" ? "text-[#C2A36B]" : ""}>03 · Confirm</span>
      </div>

      {/* Step 1 — Venue */}
      {step === "venue" && (
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up">
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setSelectedVenue(v);
                setStep("perk");
              }}
              data-testid={`redeem-venue-${v.id}`}
              className="text-left group card-invite"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={v.image_url}
                  alt={v.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0912] via-transparent to-transparent" />
                <div className="absolute left-4 top-4">
                  <StatusIndicator status={v.status} />
                </div>
                <div className="absolute inset-x-4 bottom-4">
                  <div className="overline mb-1.5">{v.neighborhood}</div>
                  <div className="font-serif-display text-2xl">{v.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — Perk */}
      {step === "perk" && selectedVenue && (
        <div className="mt-10 animate-fade-up">
          <div className="overline mb-4">Selected room</div>
          <div className="font-serif-display text-3xl">{selectedVenue.name}</div>
          <button
            onClick={() => setStep("venue")}
            data-testid="change-venue-button"
            className="overline mt-1 hover:text-[#C2A36B] transition-colors duration-300"
          >
            Change
          </button>

          <div className="mt-10 space-y-3">
            {affordablePerks.map((p) => {
              const disabled = !p.affordable || !p.tier_ok;
              return (
                <button
                  key={p.code}
                  disabled={disabled}
                  onClick={() => {
                    setSelectedPerk(p);
                    setStep("confirm");
                  }}
                  data-testid={`perk-${p.code}`}
                  className={cn(
                    "w-full text-left p-5 sm:p-6 border transition-colors duration-300 flex items-center justify-between gap-6",
                    disabled
                      ? "border-[#4E1E32] opacity-40 cursor-not-allowed"
                      : "border-[#4E1E32] hover:border-[#C2A36B]",
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-serif-display text-2xl">{p.name}</div>
                      {!p.tier_ok && (
                        <Lock strokeWidth={1.2} className="h-3.5 w-3.5 text-[#B39586]" />
                      )}
                    </div>
                    <div className="text-sm text-[#B39586] mt-1 font-light">
                      {p.description}
                    </div>
                    <div className="overline mt-2">
                      {!p.tier_ok
                        ? `${p.tier_required} tier required`
                        : !p.affordable
                          ? "Not enough Table Points yet"
                          : `Reserved for ${p.tier_required}+`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif-display text-3xl text-[#C2A36B]">{p.cost}</div>
                    <div className="overline mt-0.5">Points</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === "confirm" && selectedPerk && selectedVenue && (
        <div className="mt-10 animate-fade-up">
          <div className="p-6 sm:p-10 border border-[#C2A36B]/30 bg-[#2E1220]">
            <div className="overline">Confirming</div>
            <h2 className="font-serif-display text-4xl mt-2">{selectedPerk.name}</h2>
            <div className="font-serif italic text-lg text-[#B39586] mt-1">
              at {selectedVenue.name}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <div className="overline mb-1">Cost</div>
                <div className="font-serif-display text-3xl text-[#C2A36B]">{selectedPerk.cost}</div>
              </div>
              <div>
                <div className="overline mb-1">Balance now</div>
                <div className="font-serif-display text-3xl">{balance}</div>
              </div>
              <div>
                <div className="overline mb-1">After</div>
                <div className="font-serif-display text-3xl">{balance - selectedPerk.cost}</div>
              </div>
            </div>

            <p className="mt-8 text-sm text-[#B39586] font-light leading-relaxed max-w-lg">
              {selectedPerk.description}. Present the code on arrival — the room will be expecting you.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={submit}
                disabled={busy}
                data-testid="confirm-redeem-button"
                className="btn-primary"
              >
                {busy ? "One moment" : "Redeem"}
              </button>
              <button
                onClick={() => setStep("perk")}
                data-testid="back-to-perk-button"
                className="btn-ghost"
              >
                Change perk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === "done" && redemption && (
        <div className="mt-10 animate-fade">
          <div className="mx-auto max-w-lg text-center relative">
            <Sparkles count={26} />
            <div className="relative mx-auto w-14 h-14 border border-[#C2A36B] flex items-center justify-center">
              <Check strokeWidth={1} className="h-7 w-7 text-[#C2A36B]" />
            </div>
            <div className="overline-accent mt-6 relative">A table awaits</div>
            <h2 className="font-serif-display text-4xl mt-3 relative">
              {redemption.perk_name} at {redemption.venue_name}.
            </h2>
            <p className="text-[#B39586] font-light mt-4">
              Present this code on arrival. The room already knows you&apos;re coming.
            </p>

            <div className="mt-10 border border-[#C2A36B]/40 p-8">
              <div className="overline mb-3">Reservation code</div>
              <div
                className="font-mono text-4xl tracking-[0.3em] text-[#C2A36B]"
                data-testid="redemption-code"
              >
                {redemption.code}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/wallet")}
                data-testid="done-view-wallet"
                className="btn-primary"
              >
                Return to Wallet
              </button>
              <button
                onClick={() => navigate(`/venues/${redemption.venue_id}`)}
                data-testid="done-view-venue"
                className="btn-ghost"
              >
                View {redemption.venue_name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
