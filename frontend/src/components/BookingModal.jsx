import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Users, CalendarDays, Clock3, CheckCircle2, Minus, Plus, Sun, Moon, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Link } from "react-router-dom";
import { AddToCalendar } from "@/components/AddToCalendar";
import { cn } from "@/lib/utils";

const serif = "font-['Cormorant_Garamond']";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8A27F]";

// Local calendar date. (toISOString is UTC and can land on the previous day east of UTC, e.g. India.)
function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SERVICES = [
  { key: "lunch", label: "Lunch", icon: Sun, match: (h) => h >= 6 && h < 17 },
  { key: "dinner", label: "Dinner", icon: Moon, match: (h) => h >= 17 || h < 6 },
];

let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

function labelFor(d, today) {
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Tonight";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function BookingModal({ venue, onClose, onBooked }) {
  const { user } = useAuth();
  const depositAmount = venue.booking_deposit_amount || 0;
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Build a rolling 7-day window of dates
  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, [today]);

  const [selectedDate, setSelectedDate] = useState(isoDate(today));
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingSlots(true);
      setSelectedTime("");
      try {
        const { data } = await api.get(`/venues/${venue.id}/availability`, {
          params: { date: selectedDate },
        });
        if (!cancelled) setSlots(data.slots || []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    if (!confirmed) load();
    return () => {
      cancelled = true;
    };
  }, [venue.id, selectedDate, confirmed]);

  const payAndConfirm = async (booking, razorpay) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      toast.error("Could not load the payment window. Please try again.");
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: razorpay.key_id,
      order_id: razorpay.order_id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      name: "Table",
      description: `Reservation deposit — ${venue.name}`,
      prefill: { name: user?.name, email: user?.email },
      theme: { color: "#CE6A4A" },
      handler: async (response) => {
        try {
          const { data } = await api.post(`/bookings/${booking.id}/verify-payment`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setConfirmed(data);
          onBooked?.(data);
        } catch (e) {
          toast.error(e.response?.data?.detail || "Payment could not be verified.");
        } finally {
          setBusy(false);
        }
      },
      modal: {
        ondismiss: () => {
          setBusy(false);
          api.post(`/bookings/${booking.id}/cancel`).catch(() => {});
          toast("Payment cancelled — the hold on that table was released.");
        },
      },
    });
    rzp.open();
  };

  const submit = async () => {
    if (!selectedTime) {
      toast.error("Pick a time to reserve.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/bookings", {
        venue_id: venue.id,
        date: selectedDate,
        time: selectedTime,
        party_size: partySize,
        note: note.trim() || null,
      });
      if (data.requires_payment) {
        await payAndConfirm(data.booking, data.razorpay);
      } else {
        setConfirmed(data.booking);
        onBooked?.(data.booking);
        setBusy(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not reserve — try another slot.");
      setBusy(false);
    }
  };

  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const hourRanges = (venue.hours || "").split(",").map((h) => h.trim()).filter(Boolean);
  const groups = SERVICES.map((g) => ({
    ...g,
    slots: slots.filter((s) => g.match(parseInt(s.time, 10))),
  })).filter((g) => g.slots.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B0705]/85 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      data-testid="booking-modal"
    >
      <div
        className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-[#17110C] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_80%_0%,rgba(232,162,127,0.18),transparent_65%)]"
        />
        <button
          onClick={onClose}
          data-testid="booking-close"
          aria-label="Close"
          className="absolute top-5 right-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#B8AA98] transition-colors hover:border-white/30 hover:text-white"
        >
          <X strokeWidth={1.6} className="h-4 w-4" />
        </button>

        {confirmed ? (
          <div className="relative p-7 sm:p-10" data-testid="booking-confirmed">
            <div className={cn(eyebrow, "inline-flex items-center gap-2")}>
              <CheckCircle2 strokeWidth={1.6} className="h-4 w-4" />
              Reservation confirmed
            </div>
            <h2 className={cn(serif, "mt-3 text-5xl font-semibold leading-[1.02] text-[#F4F1EC]")}>
              {confirmed.venue_name} is expecting you.
            </h2>
            <div className="mt-7 rounded-2xl border border-[#E8C9A0]/25 bg-[#0F0A07] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B8AA98]">Reservation code</div>
              <div
                className="mt-2 text-3xl tabular-nums tracking-[0.28em] text-[#E8C9A0]"
                data-testid="booking-code"
              >
                {confirmed.code}
              </div>
              {confirmed.payment_status === "paid" && (
                <div
                  className="mt-4 border-t border-white/10 pt-4 text-sm text-[#B8AA98]"
                  data-testid="booking-deposit-paid"
                >
                  ₹{confirmed.deposit_amount} deposit paid — adjusted against your final bill.
                </div>
              )}
              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                {[
                  ["Date", new Date(confirmed.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })],
                  ["Time", confirmed.time],
                  ["Party", confirmed.party_size],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8982]">{k}</div>
                    <div className={cn(serif, "mt-1 text-2xl font-semibold text-[#F4F1EC]")}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-6 text-sm text-[#B8AA98]">
              Show this code at the host stand — the room will confirm it shortly. You&apos;ll find it under{" "}
              <Link to="/bookings" className="text-[#F0D3AE] underline-offset-4 hover:underline">Your reservations</Link>.
            </p>
            <div className="mt-5">
              <AddToCalendar booking={confirmed} />
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={onClose}
                data-testid="booking-done"
                className="rounded-full bg-[#F07F5E] px-8 py-3.5 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F59273]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative p-7 pb-0 sm:p-10 sm:pb-0">
              <div className="flex items-center gap-3">
                <span className={eyebrow}>Reserve</span>
                <span className="h-px w-10 bg-[#E8A27F]/60" />
              </div>
              <h2 className={cn(serif, "mt-3 text-5xl font-semibold leading-[1.02] text-[#F4F1EC]")}>
                A table at {venue.name}.
              </h2>
              {hourRanges.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-[#B8AA98]">
                  <span>Open</span>
                  {hourRanges.map((h) => (
                    <span key={h} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 tabular-nums text-[#F0D3AE]">
                      {h}
                    </span>
                  ))}
                </div>
              )}

              {/* Date picker */}
              <div className="mt-8">
                <label className={cn(eyebrow, "mb-3 flex items-center gap-2 !text-[#B8AA98]")}>
                  <CalendarDays strokeWidth={1.6} className="h-3.5 w-3.5" />
                  Choose a night
                </label>
                <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="booking-dates">
                  {dateOptions.map((d) => {
                    const iso = isoDate(d);
                    const active = iso === selectedDate;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        data-testid={`booking-date-${iso}`}
                        className={cn(
                          "min-w-[96px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                          active
                            ? "border-[#F07F5E] bg-[#F07F5E]/10 shadow-[0_0_0_1px_rgba(240,127,94,0.4)]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/30",
                        )}
                      >
                        <div className={cn("text-[10.5px] font-semibold uppercase tracking-[0.16em]", active ? "text-[#F59273]" : "text-[#8E8982]")}>
                          {labelFor(d, today)}
                        </div>
                        <div className={cn(serif, "mt-1 text-2xl font-semibold", active ? "text-white" : "text-[#F4F1EC]/75")}>
                          {d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div className="mt-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className={cn(eyebrow, "flex items-center gap-2 !text-[#B8AA98]")}>
                    <Clock3 strokeWidth={1.6} className="h-3.5 w-3.5" />
                    Pick a time
                  </label>
                  <div className="flex items-center gap-4 text-[11px] text-[#8E8982]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7DBE8A]" />Open</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E8A33D]" />Few left</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5A524B]" />Booked</span>
                  </div>
                </div>
                {loadingSlots ? (
                  <div className="py-6 text-sm text-[#8E8982]">Reading the room…</div>
                ) : slots.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-6 text-center text-sm text-[#8E8982]">
                    No seatings offered this date.
                  </div>
                ) : (
                  <div className="space-y-5" data-testid="booking-slots">
                    {groups.map((g) => (
                      <div key={g.key}>
                        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#F0D3AE]">
                          <g.icon strokeWidth={1.6} className="h-3.5 w-3.5" />
                          {g.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {g.slots.map((s) => {
                            const active = s.time === selectedTime;
                            const disabled = !s.available;
                            const few = !disabled && s.remaining <= 2;
                            return (
                              <button
                                key={s.time}
                                type="button"
                                disabled={disabled}
                                onClick={() => setSelectedTime(s.time)}
                                title={s.passed ? "This time has passed" : disabled ? "Fully booked" : undefined}
                                data-testid={`booking-slot-${s.time}`}
                                className={cn(
                                  "rounded-xl border px-2 py-2.5 text-center tabular-nums transition-all duration-200",
                                  active
                                    ? "border-[#F07F5E] bg-[#F07F5E] text-[#2A0F07] shadow-[0_6px_18px_rgba(240,127,94,0.35)]"
                                    : disabled
                                      ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-[#5A524B]"
                                      : "border-white/10 bg-white/[0.03] text-[#F4F1EC] hover:border-[#E8C9A0]/60",
                                )}
                              >
                                <span className={cn("block text-[15px] font-semibold", disabled && "line-through")}>{s.time}</span>
                                <span
                                  className={cn(
                                    "mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.1em]",
                                    active ? "text-[#2A0F07]/70" : disabled ? "text-[#6B6560]" : few ? "text-[#E8A33D]" : "text-[#7DBE8A]",
                                  )}
                                >
                                  {s.passed ? "Passed" : disabled ? "Booked" : few ? `${s.remaining} left` : "Open"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Party size */}
              <div className="mt-7">
                <label className={cn(eyebrow, "mb-3 flex items-center gap-2 !text-[#B8AA98]")}>
                  <Users strokeWidth={1.6} className="h-3.5 w-3.5" />
                  Party of
                </label>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                    data-testid="booking-party-decrement"
                    className="grid h-10 w-10 place-items-center rounded-full text-[#B8AA98] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Decrease party size"
                  >
                    <Minus strokeWidth={1.6} className="h-4 w-4" />
                  </button>
                  <div
                    className={cn(serif, "min-w-[3.5rem] text-center text-3xl font-semibold tabular-nums text-[#F4F1EC]")}
                    data-testid="booking-party-size"
                  >
                    {partySize}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                    data-testid="booking-party-increment"
                    className="grid h-10 w-10 place-items-center rounded-full text-[#B8AA98] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Increase party size"
                  >
                    <Plus strokeWidth={1.6} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Optional note */}
              <div className="mt-7">
                <label className={cn(eyebrow, "mb-2 block !text-[#B8AA98]")}>A note to the room (optional)</label>
                <textarea
                  rows={2}
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Celebrating a birthday. A quiet corner if possible."
                  data-testid="booking-note-input"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[#F4F1EC] outline-none transition-colors placeholder:text-[#6B6560] focus:border-[#E8C9A0]/60"
                />
              </div>

              {/* Summary + price (the deposit is set by the restaurant in its staff panel) */}
              <div className="mt-7 rounded-2xl border border-[#E8C9A0]/20 bg-[#0F0A07] p-5" data-testid="booking-summary-card">
                {selectedTime ? (
                  <p className="text-[15px] text-[#F4F1EC]" data-testid="booking-summary">
                    {dateLabel}
                    {" · "}{selectedTime}{" · Party of "}{partySize}
                  </p>
                ) : (
                  <p className="text-[15px] text-[#8E8982]">Choose a night and a time to see your reservation.</p>
                )}
                <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8982]">Booking deposit</div>
                    {depositAmount > 0 ? (
                      <p className="mt-1 max-w-[28ch] text-[13px] leading-snug text-[#B8AA98]" data-testid="booking-deposit-notice">
                        Set by {venue.name}. Adjusted against your final bill, and refunded in full if the room declines.
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] text-[#B8AA98]" data-testid="booking-deposit-notice">
                        No deposit needed — just show up.
                      </p>
                    )}
                  </div>
                  <div className={cn(serif, "text-4xl font-semibold tabular-nums", depositAmount > 0 ? "text-[#E8C9A0]" : "text-[#7DBE8A]")} data-testid="booking-deposit-amount">
                    {depositAmount > 0 ? `₹${depositAmount.toLocaleString("en-IN")}` : "Free"}
                  </div>
                </div>
                {depositAmount > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-[#8E8982]">
                    <ShieldCheck strokeWidth={1.6} className="h-4 w-4 text-[#7DBE8A]" />
                    Secure payment by Razorpay. We never see your card details.
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-4 bg-gradient-to-t from-[#17110C] via-[#17110C] to-[#17110C]/90 p-7 pt-4 sm:px-10 sm:pb-8">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !selectedTime}
                data-testid="booking-submit"
                className="rounded-full bg-[#F07F5E] px-8 py-3.5 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F59273] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? "Holding…"
                  : depositAmount > 0
                    ? `Reserve — pay ₹${depositAmount} deposit`
                    : "Reserve the table"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-[#B8AA98] transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
