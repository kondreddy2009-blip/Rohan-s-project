import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { api, assetUrl, formatApiError } from "@/lib/api";
import { AddToCalendar } from "@/components/AddToCalendar";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { label: "Awaiting the room", color: "text-[#E8A33D]" },
  confirmed: { label: "Confirmed", color: "text-[#7DBE8A]" },
  awaiting_payment: { label: "Awaiting payment", color: "text-[#E8A33D]" },
  seated: { label: "Dined", color: "text-[#8E8982]" },
  declined: { label: "Declined", color: "text-[#E27D60]" },
  cancelled: { label: "Cancelled", color: "text-[#8E8982]" },
};
const ACTIVE = ["pending", "confirmed", "awaiting_payment"];

// Same rule as lib/calendar.js: 00:00–05:59 slots belong to the previous evening's service.
function startsAt(b) {
  const [h, m] = b.time.split(":").map(Number);
  const d = new Date(`${b.date}T00:00:00`);
  if (h < 6) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

function BookingCard({ b, image, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  const st = STATUS[b.status] || { label: b.status, color: "text-[#8E8982]" };
  const live = ACTIVE.includes(b.status);
  const upcoming = live && startsAt(b).getTime() + 90 * 60000 > Date.now();

  return (
    <article className="overflow-hidden rounded-2xl bg-[#1F1D1B]" data-testid={`booking-card-${b.id}`}>
      <div className="flex">
        {image && (
          <Link to={`/venues/${b.venue_id}`} className="hidden sm:block w-40 shrink-0">
            <img src={assetUrl(image)} alt="" loading="lazy" className="h-full w-full object-cover" />
          </Link>
        )}
        <div className="flex-1 p-5 sm:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/venues/${b.venue_id}`} className="block truncate text-xl font-extrabold tracking-tight hover:text-[#F4764F] transition-colors">
                {b.venue_name}
              </Link>
              <div className="mt-1 text-sm text-[#B8B2AA]">
                {new Date(b.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {" · "}{b.time}{" · Party of "}{b.party_size}
              </div>
            </div>
            <span className={cn("shrink-0 text-xs font-bold uppercase tracking-widest", st.color)}>{st.label}</span>
          </div>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-xs text-[#8E8982]">Code</span>
            <span className="font-mono tracking-[0.28em] text-[#F4764F]">{b.code}</span>
          </div>
          {b.payment_status === "paid" && (
            <div className="mt-2 text-xs text-[#8E8982]">₹{b.deposit_amount} deposit paid · adjusted against your bill</div>
          )}
          {b.payment_status === "refunded" && <div className="mt-2 text-xs text-[#7DBE8A]">₹{b.deposit_amount} deposit refunded</div>}
          {b.note && <p className="mt-3 text-sm italic text-[#B8B2AA]">&ldquo;{b.note}&rdquo;</p>}
          {b.staff_reply && (
            <div className="mt-3 border-t border-white/[0.08] pt-3">
              <div className="text-xs font-bold text-[#F4764F]">The room replied</div>
              <p className="mt-1 text-sm text-[#B8B2AA]">{b.staff_reply}</p>
            </div>
          )}

          {upcoming && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <AddToCalendar booking={b} />
              {confirming ? (
                <span className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => onCancel(b.id)} data-testid={`booking-confirm-cancel-${b.id}`} className="font-bold text-[#E27D60] hover:text-[#F87171]">
                    Yes, release it
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="font-semibold text-[#8E8982] hover:text-white">
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} data-testid={`booking-cancel-${b.id}`} className="text-sm font-semibold text-[#8E8982] hover:text-[#E8A33D] transition-colors">
                  Release the table
                </button>
              )}
            </div>
          )}
          {b.status === "seated" && (
            <Link to={`/venues/${b.venue_id}#venue-reviews`} className="mt-4 inline-block text-sm font-bold text-[#E27D60] hover:text-[#F4764F]">
              Rate your visit →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState(null);
  const [images, setImages] = useState({});
  const [tab, setTab] = useState("upcoming");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/members/me/bookings");
      setBookings(data);
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    load();
    api.get("/venues").then(({ data }) => setImages(Object.fromEntries(data.map((v) => [v.id, v.image_url])))).catch(() => {});
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const isUpcoming = (b) => ACTIVE.includes(b.status) && startsAt(b).getTime() + 90 * 60000 > now;
    const list = bookings || [];
    return {
      upcoming: list.filter(isUpcoming).sort((a, b) => startsAt(a) - startsAt(b)),
      past: list.filter((b) => !isUpcoming(b)).sort((a, b) => startsAt(b) - startsAt(a)),
    };
  }, [bookings]);

  const cancel = async (id) => {
    try {
      await api.post(`/bookings/${id}/cancel`);
      toast.success("Reservation cancelled.");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not cancel just now.");
    }
  };

  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-8" data-testid="bookings-page">
      <div className="pt-6">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">Your reservations</h1>
        <p className="mt-1 text-sm text-[#8E8982]">Tables held in your name, across the network.</p>
      </div>

      <div className="mt-6 flex gap-2" role="tablist">
        {[
          { key: "upcoming", label: "Upcoming", n: upcoming.length },
          { key: "past", label: "Past", n: past.length },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`bookings-tab-${t.key}`}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
              tab === t.key ? "bg-[#F5F5F3] text-[#171513]" : "bg-[#2A2826] text-[#B8B2AA] hover:text-white",
            )}
          >
            {t.label} <span className="opacity-60">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {bookings === null ? (
          <div className="py-16 text-center text-sm text-[#8E8982]">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl bg-[#1F1D1B] px-6 py-14 text-center" data-testid="bookings-empty">
            <CalendarCheck strokeWidth={1.4} className="mx-auto h-8 w-8 text-[#E27D60]" />
            <div className="mt-3 font-bold">{tab === "upcoming" ? "Nothing booked yet" : "No past reservations"}</div>
            <p className="mt-1 text-sm text-[#8E8982]">Find a room and hold a table in a few taps.</p>
            <Link to="/discover" className="mt-5 inline-block rounded-full bg-[#F4764F] px-6 py-3 text-sm font-extrabold text-[#1A0F0B] hover:bg-[#F78963] transition-colors">
              Explore restaurants
            </Link>
          </div>
        ) : (
          shown.map((b) => <BookingCard key={b.id} b={b} image={images[b.venue_id]} onCancel={cancel} />)
        )}
      </div>
    </div>
  );
}
