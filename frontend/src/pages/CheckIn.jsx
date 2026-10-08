import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { QrCode, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AnimatedNumber } from "@/components/AnimatedNumber";

export default function CheckIn() {
  const { id } = useParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [step, setStep] = useState("scan"); // scan → confirmed → feedback → done
  const [result, setResult] = useState(null);
  const [item, setItem] = useState("");
  const [wouldReturn, setWouldReturn] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/venues/${id}`).then((r) => setVenue(r.data));
  }, [id]);

  const doCheckIn = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/venues/${id}/checkin`, {});
      setResult(data);
      await refresh();
      setStep("confirmed");
      // After a beat, move to feedback
      setTimeout(() => setStep("feedback"), 1400);
    } catch (e) {
      toast.error("A quiet error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitFeedback = async () => {
    if (!result) return;
    setBusy(true);
    try {
      if (item.trim() && wouldReturn !== null) {
        await api.post(`/checkins/feedback`, {
          checkin_id: result.checkin_id,
          item_ordered: item.trim(),
          would_return: wouldReturn,
        });
      }
      setStep("done");
    } catch {
      toast.error("Could not save that just now.");
    } finally {
      setBusy(false);
    }
  };

  if (!venue) {
    return <div className="mx-auto max-w-2xl px-5 py-16 overline text-center">Loading room…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl py-2 min-h-[60vh] flex flex-col" data-testid="checkin-page">
      <div className="overline">Check-in</div>
      <h1 className="font-serif-display text-4xl sm:text-5xl mt-2">{venue.name}</h1>
      <div className="overline mt-2">{venue.neighborhood} · {venue.type}</div>

      <div className="mt-12 flex-1 flex flex-col justify-center">
        {step === "scan" && (
          <div className="animate-fade-up text-center">
            <div className="mx-auto w-40 h-40 rounded-full border border-[#262321] flex items-center justify-center relative overflow-hidden">
              <QrCode strokeWidth={0.8} className="h-24 w-24 text-[#CE6A4A]" />
              <div className="absolute inset-x-0 h-px bg-[#CE6A4A]/60 animate-fade-up" />
            </div>
            <p className="mt-8 font-serif text-xl text-[#F2EDE7]/80 max-w-md mx-auto">
              A quiet gesture. Confirm your arrival to begin.
            </p>
            <button
              onClick={doCheckIn}
              disabled={busy}
              data-testid="confirm-checkin-button"
              className="btn-primary mt-10"
            >
              {busy ? "One moment" : "Confirm arrival"}
            </button>
          </div>
        )}

        {step === "confirmed" && result && (
          <div className="animate-fade text-center">
            <div className="mx-auto w-16 h-16 rounded-full border border-[#CE6A4A] flex items-center justify-center">
              <Check strokeWidth={1} className="h-8 w-8 text-[#CE6A4A]" />
            </div>
            <div className="overline-accent mt-6">Welcomed</div>
            <h2 className="font-serif-display text-4xl mt-3">
              Your Table continues at {venue.name}.
            </h2>
            <div className="mt-10">
              <div className="overline mb-2">Table Points earned</div>
              <div data-testid="points-earned">
                <AnimatedNumber
                  value={result.points_earned}
                  prefix="+"
                  className="font-serif-display text-7xl text-[#CE6A4A] tabular-nums block"
                />
              </div>
              <div className="overline mt-4">
                Balance · <span className="text-[#F2EDE7]"><AnimatedNumber value={result.balance} /></span>
              </div>
            </div>
          </div>
        )}

        {step === "feedback" && result && (
          <div className="animate-fade-up">
            <div className="overline">A quiet question</div>
            <h2 className="font-serif-display text-3xl mt-2 leading-tight">
              What did you have this evening?
            </h2>
            <p className="text-[#8F8781] font-light mt-3">
              This will help other members find the things worth returning for.
            </p>

            <div className="mt-8">
              <label className="overline block mb-3">Item</label>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="A dish, a pour, a pastry…"
                data-testid="feedback-item-input"
                className="w-full bg-transparent border-b border-[#262321] py-3 text-[#F2EDE7] font-light focus:border-[#CE6A4A] outline-none transition-colors duration-300 placeholder:text-[#6B6560]"
              />
            </div>

            <div className="mt-8">
              <div className="overline mb-3">Would you return for it?</div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWouldReturn(true)}
                  data-testid="feedback-yes"
                  className={`btn-ghost ${wouldReturn === true ? "border-[#CE6A4A] text-[#CE6A4A]" : ""}`}
                >
                  Yes, gladly
                </button>
                <button
                  type="button"
                  onClick={() => setWouldReturn(false)}
                  data-testid="feedback-no"
                  className={`btn-ghost ${wouldReturn === false ? "border-[#CE6A4A] text-[#CE6A4A]" : ""}`}
                >
                  Not quite
                </button>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-4">
              <button
                onClick={submitFeedback}
                disabled={busy}
                data-testid="feedback-submit-button"
                className="btn-primary"
              >
                Continue
              </button>
              <button
                onClick={() => setStep("done")}
                data-testid="feedback-skip"
                className="overline text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-300"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="animate-fade text-center">
            <div className="overline-accent">Recorded</div>
            <h2 className="font-serif-display text-4xl mt-3">
              A trace of this evening lives in your wallet.
            </h2>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/wallet"
                data-testid="post-checkin-wallet-link"
                className="btn-primary"
              >
                View Wallet
              </Link>
              <Link
                to="/discover"
                data-testid="post-checkin-discover-link"
                className="btn-ghost"
              >
                Return to rooms
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
