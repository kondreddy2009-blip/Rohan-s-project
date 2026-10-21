import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Users, CalendarDays, Clock3, CheckCircle2, Minus, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Link } from "react-router-dom";
import { AddToCalendar } from "@/components/AddToCalendar";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

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
      theme: { color: "#F4764F" },
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#141312]/85 backdrop-blur-sm"
      onClick={onClose}
      data-testid="booking-modal"
    >
      <div
        className="relative w-full sm:max-w-lg rounded-2xl bg-[#1F1D1B] border border-white/[0.08] p-8 sm:p-10 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          data-testid="booking-close"
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8E8982] hover:text-[#F4F1EC] transition-colors duration-300"
        >
          <X strokeWidth={1.2} className="h-5 w-5" />
        </button>

        {confirmed ? (
          <div data-testid="booking-confirmed">
            <div className="overline-accent inline-flex items-center gap-2">
              <CheckCircle2 strokeWidth={1.4} className="h-3.5 w-3.5" />
              Reservation confirmed
            </div>
            <h2 className="font-serif-display text-3xl mt-3 leading-tight">
              {confirmed.venue_name} is expecting you.
            </h2>
            <div className="mt-6 p-6 border border-[#F4764F]/30 bg-[#141312]">
              <div className="overline mb-2">Reservation code</div>
              <div
                className="font-sans tabular-nums tracking-[0.28em] text-[#F4764F] text-2xl"
                data-testid="booking-code"
              >
                {confirmed.code}
              </div>
              {confirmed.payment_status === "paid" && (
                <div
                  className="mt-4 pt-4 border-t border-white/[0.05] text-sm text-[#8E8982] font-light"
                  data-testid="booking-deposit-paid"
                >
                  ₹{confirmed.deposit_amount} deposit paid — adjusted against your final bill.
                </div>
              )}
              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="overline mb-1">Date</div>
                  <div className="text-[#F4F1EC]/85 font-light">
                    {new Date(confirmed.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div>
                  <div className="overline mb-1">Time</div>
                  <div className="text-[#F4F1EC]/85 font-light">{confirmed.time}</div>
                </div>
                <div>
                  <div className="overline mb-1">Party</div>
                  <div className="text-[#F4F1EC]/85 font-light">{confirmed.party_size}</div>
                </div>
              </div>
            </div>
            <p className="mt-6 text-sm text-[#8E8982] font-light">
              Show this code at the host stand — the room will confirm it shortly. You&apos;ll find
              it under <Link to="/bookings" className="text-[#F4764F] underline-offset-4 hover:underline">Your reservations</Link>.
            </p>
            <div className="mt-5">
              <AddToCalendar booking={confirmed} />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                data-testid="booking-done"
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overline">Reserve</div>
            <h2 className="font-serif-display text-3xl mt-2 leading-tight">
              A table at {venue.name}.
            </h2>
            <p className="text-sm text-[#8E8982] font-light mt-2">
              Hours {venue.hours || "—"}. The room seats each slot in stride.
            </p>

            {/* Date picker */}
            <div className="mt-8">
              <label className="overline flex mb-3 items-center gap-2">
                <CalendarDays strokeWidth={1.4} className="h-3 w-3" />
                Choose a night
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="booking-dates">
                {dateOptions.map((d) => {
                  const iso = isoDate(d);
                  const active = iso === selectedDate;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      data-testid={`booking-date-${iso}`}
                      className={`shrink-0 px-4 py-3 border transition-colors duration-300 min-w-[92px] text-left ${
                        active
                          ? "border-[#F4764F] bg-[#141312]"
                          : "border-[#3A3733] hover:border-[#8E8982]"
                      }`}
                    >
                      <div
                        className={`text-xs tracking-widest uppercase ${
                          active ? "text-[#F4764F]" : "text-[#8E8982]"
                        }`}
                      >
                        {labelFor(d, today)}
                      </div>
                      <div
                        className={`font-serif text-lg mt-1 ${
                          active ? "text-[#F4F1EC]" : "text-[#F4F1EC]/70"
                        }`}
                      >
                        {d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="mt-6">
              <label className="overline flex mb-3 items-center gap-2">
                <Clock3 strokeWidth={1.4} className="h-3 w-3" />
                Pick a time
              </label>
              {loadingSlots ? (
                <div className="overline py-4">Reading the room…</div>
              ) : slots.length === 0 ? (
                <div className="overline py-4">No seatings offered this date.</div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2" data-testid="booking-slots">
                  {slots.map((s) => {
                    const active = s.time === selectedTime;
                    const disabled = !s.available;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedTime(s.time)}
                        data-testid={`booking-slot-${s.time}`}
                        className={`px-2 py-2.5 border font-sans text-sm tabular-nums tracking-wider transition-colors duration-200 ${
                          active
                            ? "border-[#F4764F] text-[#F4764F] bg-[#141312]"
                            : disabled
                              ? "border-[#2A2724] text-[#6B665F] cursor-not-allowed line-through"
                              : "border-[#3A3733] text-[#F4F1EC] hover:border-[#8E8982]"
                        }`}
                      >
                        {s.time}
                        {!disabled && s.remaining <= 2 && (
                          <span className="mt-0.5 block text-[10px] normal-case tracking-normal text-[#E8A33D]">
                            {s.remaining} left
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Party size */}
            <div className="mt-6">
              <label className="overline flex mb-3 items-center gap-2">
                <Users strokeWidth={1.4} className="h-3 w-3" />
                Party of
              </label>
              <div className="inline-flex items-center border border-[#3A3733]">
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                  data-testid="booking-party-decrement"
                  className="px-3 py-3 text-[#8E8982] hover:text-[#F4F1EC] transition-colors duration-200"
                  aria-label="Decrease party size"
                >
                  <Minus strokeWidth={1.4} className="h-4 w-4" />
                </button>
                <div
                  className="px-6 font-serif-display text-2xl text-[#F4F1EC] tabular-nums min-w-[3.5rem] text-center"
                  data-testid="booking-party-size"
                >
                  {partySize}
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                  data-testid="booking-party-increment"
                  className="px-3 py-3 text-[#8E8982] hover:text-[#F4F1EC] transition-colors duration-200"
                  aria-label="Increase party size"
                >
                  <Plus strokeWidth={1.4} className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Optional note */}
            <div className="mt-6">
              <label className="overline block mb-2">A note to the room (optional)</label>
              <textarea
                rows={2}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Celebrating a birthday. A quiet corner if possible."
                data-testid="booking-note-input"
                className="w-full bg-transparent border border-[#3A3733] p-3 text-sm text-[#F4F1EC] font-light focus:border-[#F4764F] outline-none transition-colors duration-300 resize-none placeholder:text-[#6B665F]"
              />
            </div>

            {selectedTime && (
              <p className="mt-6 text-sm text-[#F4F1EC]/85" data-testid="booking-summary">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {" · "}{selectedTime}{" · Party of "}{partySize}
              </p>
            )}

            {depositAmount > 0 && (
              <p className="mt-6 text-sm text-[#8E8982] font-light" data-testid="booking-deposit-notice">
                A ₹{depositAmount} deposit holds this table — it&apos;s adjusted against your final bill.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !selectedTime}
                data-testid="booking-submit"
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy
                  ? "Holding"
                  : depositAmount > 0
                    ? `Reserve — pay ₹${depositAmount} deposit`
                    : "Reserve the table"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="overline text-[#8E8982] hover:text-[#F4F1EC] transition-colors duration-300"
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
