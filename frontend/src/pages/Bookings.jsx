import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ArrowRight, Star } from "lucide-react";
import { toast } from "sonner";
import { api, assetUrl, formatApiError } from "@/lib/api";
import { AddToCalendar } from "@/components/AddToCalendar";
import { cn } from "@/lib/utils";

const serif = "font-['Cormorant_Garamond']";

const STATUS = {
  pending: { label: "Awaiting the room", color: "text-[#E8A33D]" },
  confirmed: { label: "Confirmed", color: "text-[#7DBE8A]" },
  awaiting_payment: { label: "Awaiting payment", color: "text-[#E8A33D]" },
  seated: { label: "Dined", color: "text-[#8F8781]" },
  declined: { label: "Declined", color: "text-[#EE9B79]" },
  cancelled: { label: "Cancelled", color: "text-[#8F8781]" },
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
  const st = STATUS[b.status] || { label: b.status, color: "text-[#8F8781]" };
  const live = ACTIVE.includes(b.status);
  const upcoming = live && startsAt(b).getTime() + 90 * 60000 > Date.now();

  return (
    <article className="overflow-hidden rounded-2xl bg-[#1B1917]" data-testid={`booking-card-${b.id}`}>
      <div className="flex">
        {image && (
          <Link to={`/venues/${b.venue_id}`} className="hidden sm:block w-40 shrink-0">
            <img src={assetUrl(image)} alt="" loading="lazy" className="h-full w-full object-cover" />
          </Link>
        )}
        <div className="flex-1 p-5 sm:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/venues/${b.venue_id}`} className="block truncate text-xl font-extrabold tracking-tight hover:text-[#CE6A4A] transition-colors">
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
            <span className="text-xs text-[#8F8781]">Code</span>
            <span className="font-mono tracking-[0.28em] text-[#CE6A4A]">{b.code}</span>
          </div>
          {b.payment_status === "paid" && (
            <div className="mt-2 text-xs text-[#8F8781]">₹{b.deposit_amount} deposit paid · adjusted against your bill</div>
          )}
          {b.payment_status === "refunded" && <div className="mt-2 text-xs text-[#7DBE8A]">₹{b.deposit_amount} deposit refunded</div>}
          {b.payment_status === "refund_failed" && (
            <div className="mt-2 text-xs text-[#E8A33D]">We couldn&apos;t refund your ₹{b.deposit_amount} deposit automatically. Contact us with code {b.code}.</div>
          )}
          {upcoming && b.payment_status === "paid" && (
            <div className="mt-2 text-xs text-[#8E8982]">Cancel at least 24 hours before to get your deposit back.</div>
          )}
          {b.note && <p className="mt-3 text-sm italic text-[#B8B2AA]">&ldquo;{b.note}&rdquo;</p>}
          {b.staff_reply && (
            <div className="mt-3 border-t border-white/[0.08] pt-3">
              <div className="text-xs font-bold text-[#CE6A4A]">The room replied</div>
              <p className="mt-1 text-sm text-[#B8B2AA]">{b.staff_reply}</p>
            </div>
          )}

          {upcoming && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <AddToCalendar booking={b} />
              {confirming ? (
                <span className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => onCancel(b.id)} data-testid={`booking-confirm-cancel-${b.id}`} className="font-bold text-[#EE9B79] hover:text-[#F87171]">
                    Yes, release it
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="font-semibold text-[#8F8781] hover:text-white">
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} data-testid={`booking-cancel-${b.id}`} className="text-sm font-semibold text-[#8F8781] hover:text-[#E8A33D] transition-colors">
                  Release the table
                </button>
              )}
            </div>
          )}
          {b.status === "seated" && (
            <Link to={`/venues/${b.venue_id}#venue-reviews`} className="mt-4 inline-block text-sm font-bold text-[#EE9B79] hover:text-[#CE6A4A]">
              Rate your visit →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8A27F]">
      {children}
      <span className="h-px w-12 bg-[#E8A27F]/60" />
    </div>
  );
}

function PartnerRow({ v }) {
  return (
    <Link
      to={`/venues/${v.id}`}
      data-testid={`partner-${v.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#141312]/90 p-2.5 pr-4 transition-colors hover:border-[#CE6A4A]/40"
    >
      <img src={assetUrl(v.image_url)} alt="" loading="lazy" className="h-[88px] w-[88px] shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className={cn(serif, "truncate text-[22px] font-semibold leading-tight text-[#F2EDE7]")}>{v.name}</div>
        <div className="mt-0.5 truncate text-[13px] text-[#B8AA98]">{[v.cuisine, v.neighborhood].filter(Boolean).join(" · ")}</div>
        {v.rating_avg > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#B8AA98]">
            <Star className="h-3.5 w-3.5 fill-[#E8A27F] text-[#E8A27F]" />
            {v.rating_avg.toFixed(1)}
            {v.rating_count > 0 && <span>({v.rating_count})</span>}
          </div>
        )}
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#CE6A4A]/60 text-[#CE6A4A] transition-colors group-hover:bg-[#CE6A4A] group-hover:text-[#0B0A0A]">
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState(null);
  const [venues, setVenues] = useState([]);
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
    api.get("/venues").then(({ data }) => setVenues(data)).catch(() => {});
  }, [load]);

  const images = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v.image_url])), [venues]);
  const partners = useMemo(
    () =>
      [...venues]
        .sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0))
        .slice(0, 3),
    [venues],
  );

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
      const { data } = await api.post(`/bookings/${id}/cancel`);
      if (data.refund === "refunded") toast.success("Reservation cancelled. Your deposit is being refunded (5 to 7 business days).");
      else if (data.refund === "refund_failed") toast.error("Cancelled, but we couldn't refund your deposit automatically. Please contact us with your booking code.");
      else if (data.refund === "not_eligible") toast("Cancelled. This was less than 24 hours before, so the deposit isn't refunded.");
      else toast.success("Reservation cancelled.");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not cancel just now.");
    }
  };

  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div className="relative px-5 sm:px-10 lg:px-16 pb-12" data-testid="bookings-page">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_85%_0%,rgba(232,162,127,0.16),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-[1280px]">
        <div className="pt-4">
          <Eyebrow>Bookings</Eyebrow>
          <h1 className={cn(serif, "mt-4 text-5xl sm:text-6xl font-semibold tracking-[-0.01em] text-[#F2EDE7]")}>Your reservations</h1>
          <p className="mt-2 text-lg text-[#B8AA98]">Every table, all in one place.</p>
        </div>

        <div className="mt-8 flex gap-2" role="tablist">
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
                "rounded-full px-6 py-3 text-[15px] font-semibold transition-colors",
                tab === t.key ? "bg-[#F5F5F3] text-[#121110]" : "bg-[#23201E] text-[#B8B2AA] hover:text-white",
              )}
            >
              {t.label} <span className="opacity-60">{t.n}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div className="space-y-4">
            {bookings === null ? (
              <div className="py-16 text-center text-sm text-[#8F8781]">Loading…</div>
            ) : shown.length === 0 ? (
              <div
                className="flex min-h-[380px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#141312]/90 px-6 py-14 text-center"
                data-testid="bookings-empty"
              >
                <CalendarCheck strokeWidth={1.2} className="h-14 w-14 text-[#E8A27F]" />
                <div className={cn(serif, "mt-6 text-4xl font-semibold text-[#F2EDE7]")}>
                  {tab === "upcoming" ? "Your next great evening starts here" : "No past reservations yet"}
                </div>
                <p className="mt-2 text-[16px] text-[#B8AA98]">Discover a restaurant or book a seat at an upcoming event.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    to="/discover"
                    className="inline-flex items-center gap-2 rounded-full bg-[#F07F5E] px-7 py-3.5 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F59273]"
                  >
                    Explore restaurants <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/events"
                    className="inline-flex items-center rounded-full border border-[#CE6A4A]/60 px-7 py-3.5 text-[15px] font-semibold text-[#EE9B79] transition-colors hover:border-[#CE6A4A] hover:text-white"
                  >
                    Browse events
                  </Link>
                </div>
              </div>
            ) : (
              shown.map((b) => <BookingCard key={b.id} b={b} image={images[b.venue_id]} onCancel={cancel} />)
            )}
          </div>

          {partners.length > 0 && (
            <aside className="lg:border-l lg:border-white/[0.08] lg:pl-8" data-testid="bookings-partners">
              <Eyebrow>A little inspiration</Eyebrow>
              <h2 className={cn(serif, "mt-3 text-3xl font-semibold text-[#F2EDE7]")}>Explore our partners</h2>
              <p className="mt-1 text-[15px] text-[#B8AA98]">Handpicked restaurants loved by the community.</p>
              <div className="mt-5 space-y-3">
                {partners.map((v) => (
                  <PartnerRow key={v.id} v={v} />
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
