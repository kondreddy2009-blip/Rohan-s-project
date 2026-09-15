import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Users, CalendarDays, Clock3, CheckCircle2, Minus, Plus } from "lucide-react";
import { api } from "@/lib/api";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function labelFor(d, today) {
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Tonight";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function BookingModal({ venue, onClose, onBooked }) {
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
      setConfirmed(data);
      onBooked?.(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not reserve — try another slot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B0A0A]/85 backdrop-blur-sm"
      onClick={onClose}
      data-testid="booking-modal"
    >
      <div
        className="relative w-full sm:max-w-lg rounded-[28px] bg-[#1B1917] border border-[#262321] p-8 sm:p-10 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          data-testid="booking-close"
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-300"
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
            <div className="mt-6 p-6 rounded-2xl border border-[#CE6A4A]/30 bg-[#0B0A0A]">
              <div className="overline mb-2">Reservation code</div>
              <div
                className="font-mono tracking-[0.28em] text-[#CE6A4A] text-2xl"
                data-testid="booking-code"
              >
                {confirmed.code}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="overline mb-1">Date</div>
                  <div className="text-[#F2EDE7]/85 font-light">
                    {new Date(confirmed.date + "T00:00:00").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div>
                  <div className="overline mb-1">Time</div>
                  <div className="text-[#F2EDE7]/85 font-light">{confirmed.time}</div>
                </div>
                <div>
                  <div className="overline mb-1">Party</div>
                  <div className="text-[#F2EDE7]/85 font-light">{confirmed.party_size}</div>
                </div>
              </div>
            </div>
            <p className="mt-6 text-sm text-[#8F8781] font-light">
              Show this code at the host stand — the room will confirm it shortly. You&apos;ll find
              it under <span className="text-[#CE6A4A]">Your reservations</span> in your profile.
            </p>
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
            <p className="text-sm text-[#8F8781] font-light mt-2">
              Hours {venue.hours || "—"}. The room seats each slot in stride.
            </p>

            {/* Date picker */}
            <div className="mt-8">
              <label className="overline block mb-3 inline-flex items-center gap-2">
                <CalendarDays strokeWidth={1.4} className="h-3 w-3" />
                Choose a night
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2" data-testid="booking-dates">
                {dateOptions.map((d) => {
                  const iso = isoDate(d);
                  const active = iso === selectedDate;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      data-testid={`booking-date-${iso}`}
                      className={`shrink-0 px-4 py-3 rounded-xl border transition-colors duration-300 min-w-[92px] text-left ${
                        active
                          ? "border-[#CE6A4A] bg-[#0B0A0A]"
                          : "border-[#262321] hover:border-[#8F8781]"
                      }`}
                    >
                      <div
                        className={`text-xs tracking-widest uppercase ${
                          active ? "text-[#CE6A4A]" : "text-[#8F8781]"
                        }`}
                      >
                        {labelFor(d, today)}
                      </div>
                      <div
                        className={`font-serif text-lg mt-1 ${
                          active ? "text-[#F2EDE7]" : "text-[#F2EDE7]/70"
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
              <label className="overline block mb-3 inline-flex items-center gap-2">
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
                        className={`px-2 py-2.5 rounded-xl border font-mono text-sm tracking-wider transition-colors duration-200 ${
                          active
                            ? "border-[#CE6A4A] text-[#CE6A4A] bg-[#0B0A0A]"
                            : disabled
                              ? "border-[#331420] text-[#6B6560] cursor-not-allowed line-through"
                              : "border-[#262321] text-[#F2EDE7] hover:border-[#8F8781]"
                        }`}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Party size */}
            <div className="mt-6">
              <label className="overline block mb-3 inline-flex items-center gap-2">
                <Users strokeWidth={1.4} className="h-3 w-3" />
                Party of
              </label>
              <div className="inline-flex items-center rounded-full border border-[#262321]">
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                  data-testid="booking-party-decrement"
                  className="px-3 py-3 text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-200"
                  aria-label="Decrease party size"
                >
                  <Minus strokeWidth={1.4} className="h-4 w-4" />
                </button>
                <div
                  className="px-6 font-serif-display text-2xl text-[#F2EDE7] tabular-nums min-w-[3.5rem] text-center"
                  data-testid="booking-party-size"
                >
                  {partySize}
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                  data-testid="booking-party-increment"
                  className="px-3 py-3 text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-200"
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
                className="w-full bg-transparent rounded-xl border border-[#262321] p-3 text-sm text-[#F2EDE7] font-light focus:border-[#CE6A4A] outline-none transition-colors duration-300 resize-none placeholder:text-[#6B6560]"
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={submit}
                disabled={busy || !selectedTime}
                data-testid="booking-submit"
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? "Holding" : "Reserve the table"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="overline text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-300"
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
