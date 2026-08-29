import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { StatusIndicator } from "@/components/StatusIndicator";
import { QRDisplay } from "@/components/QRDisplay";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Quiet", "Filling In", "At Capacity"];

const CONCIERGE_TYPE_LABEL = {
  hold_table: "Hold a table",
  preview_menu: "Preview the menu",
  request: "A request",
};

const BOOKING_STATUS_COLOR = {
  pending: "text-[#B39586]",
  confirmed: "text-[#C2A36B]",
  declined: "text-[#C08B70]",
  seated: "text-[#7A9B7A]",
  cancelled: "text-[#7A5C55]",
};

function BookingRow({ booking, onAct }) {
  const [reply, setReply] = useState(booking.staff_reply || "");
  const [busy, setBusy] = useState(false);
  const isPending = booking.status === "pending";

  const act = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/staff/bookings/${booking.id}`, {
        status,
        staff_reply: reply.trim() || null,
      });
      toast.success("Response sent.");
      onAct?.();
    } catch {
      toast.error("Could not update just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="p-5 sm:p-6 border border-[#4E1E32] bg-[#2E1220]"
      data-testid={`booking-row-${booking.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="overline">
            {new Date(booking.date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {" · "}
            {booking.time}
            {" · Party of "}
            {booking.party_size}
          </div>
          <div className="font-serif-display text-xl mt-1">
            {booking.member_name}{" "}
            <span className="text-[#C2A36B]">· {booking.member_tier}</span>
          </div>
        </div>
        <div className={cn("text-xs tracking-widest uppercase", BOOKING_STATUS_COLOR[booking.status])}>
          {booking.status}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <div className="overline">Code</div>
        <div className="font-mono tracking-[0.28em] text-[#C2A36B] text-sm">{booking.code}</div>
      </div>

      {booking.note && (
        <p className="mt-3 font-serif italic text-[#F4E8DA]/85 leading-relaxed">
          {`"${booking.note}"`}
        </p>
      )}

      {booking.staff_reply && !isPending && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <div className="overline-accent mb-1">Your reply</div>
          <p className="text-sm text-[#F4E8DA]/85 font-light">{booking.staff_reply}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-5 space-y-3">
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="A quiet reply (optional)"
            data-testid={`booking-reply-${booking.id}`}
            className="w-full bg-transparent border border-[#4E1E32] p-3 text-sm text-[#F4E8DA] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300 resize-none placeholder:text-[#7A5C55]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => act("confirmed")}
              disabled={busy}
              data-testid={`booking-confirm-${booking.id}`}
              className="btn-primary"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => act("declined")}
              disabled={busy}
              data-testid={`booking-decline-${booking.id}`}
              className="overline text-[#B39586] hover:text-[#C08B70] transition-colors duration-300"
            >
              Send regrets
            </button>
          </div>
        </div>
      )}

      {booking.status === "confirmed" && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => act("seated")}
            disabled={busy}
            data-testid={`booking-seat-${booking.id}`}
            className="btn-ghost"
          >
            Mark seated
          </button>
        </div>
      )}
    </div>
  );
}

function StatusControl({ current, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="status-control">
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          data-testid={`status-btn-${s.replace(/\s+/g, "-").toLowerCase()}`}
          className={cn(
            "px-4 py-4 border transition-colors duration-300 text-left",
            current === s
              ? "border-[#C2A36B] bg-[#2E1220]"
              : "border-[#4E1E32] hover:border-[#B39586]",
          )}
        >
          <StatusIndicator status={s} showLabel={false} />
          <div
            className={cn(
              "mt-2 font-serif text-lg",
              current === s ? "text-[#C2A36B]" : "text-[#F4E8DA]",
            )}
          >
            {s}
          </div>
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="p-6 border border-[#4E1E32] bg-[#2E1220]">
      <div className="overline mb-3">{label}</div>
      <div className="font-serif-display text-4xl tabular-nums">{value}</div>
      {hint && <div className="overline mt-2">{hint}</div>}
    </div>
  );
}

function EventForm({ venueId, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/staff/venues/${venueId}/events`, {
        title,
        description,
        date,
        time,
        tier_required: tier || null,
      });
      toast.success("Event posted.");
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setTier("");
      onCreated?.();
    } catch {
      toast.error("Could not post that event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="event-form">
      <div>
        <label className="overline block mb-2">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="event-title-input"
          className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
        />
      </div>
      <div>
        <label className="overline block mb-2">Description</label>
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="event-description-input"
          className="w-full bg-transparent border border-[#4E1E32] p-3 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300 resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="overline block mb-2">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="event-date-input"
            className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-[#F4E8DA] transition-colors duration-300"
          />
        </div>
        <div>
          <label className="overline block mb-2">Time</label>
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            data-testid="event-time-input"
            className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-[#F4E8DA] transition-colors duration-300"
          />
        </div>
      </div>
      <div>
        <label className="overline block mb-2">Tier gate (optional)</label>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          data-testid="event-tier-select"
          className="w-full bg-[#2E1220] border border-[#4E1E32] py-2 px-3 focus:border-[#C2A36B] outline-none font-light text-[#F4E8DA] transition-colors duration-300"
        >
          <option value="">Open to all members</option>
          <option value="Regular">Regular and above</option>
          <option value="Insider">Insider and above</option>
          <option value="Inner Circle">Inner Circle only</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={busy}
        data-testid="event-submit-button"
        className="btn-primary"
      >
        {busy ? "Posting" : "Post event"}
      </button>
    </form>
  );
}

function CorrespondenceRow({ msg, onRespond }) {
  const [response, setResponse] = useState(msg.response || "");
  const [busy, setBusy] = useState(false);

  const act = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/staff/concierge/${msg.id}`, {
        status,
        response: response.trim() || null,
      });
      toast.success("Reply sent.");
      onRespond?.();
    } catch {
      toast.error("Could not reply just now.");
    } finally {
      setBusy(false);
    }
  };

  const isPending = msg.status === "pending";
  const statusColor =
    msg.status === "acknowledged"
      ? "text-[#C2A36B]"
      : msg.status === "declined"
        ? "text-[#C08B70]"
        : msg.status === "fulfilled"
          ? "text-[#7A9B7A]"
          : "text-[#B39586]";

  return (
    <div
      className="p-5 sm:p-6 border border-[#4E1E32] bg-[#2E1220]"
      data-testid={`concierge-row-${msg.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="overline">{CONCIERGE_TYPE_LABEL[msg.request_type] || "Note"}</div>
          <div className="font-serif-display text-xl mt-1">
            {msg.member_name} · <span className="text-[#C2A36B]">{msg.member_tier}</span>
          </div>
        </div>
        <div className={`text-xs tracking-widest uppercase ${statusColor}`}>
          {msg.status}
        </div>
      </div>

      <p className="mt-4 font-serif italic text-[#F4E8DA]/90 leading-relaxed">
        {`"${msg.message}"`}
      </p>
      {(msg.party_size || msg.arrival_time) && (
        <div className="overline mt-3">
          {msg.party_size ? `Party of ${msg.party_size}` : ""}
          {msg.party_size && msg.arrival_time ? " · " : ""}
          {msg.arrival_time ? `Arrival ${msg.arrival_time}` : ""}
        </div>
      )}
      <div className="overline mt-2">
        {new Date(msg.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {msg.response && !isPending && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <div className="overline-accent mb-1">Your reply</div>
          <p className="text-sm text-[#F4E8DA]/85 font-light">{msg.response}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-5 space-y-3">
          <textarea
            rows={2}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="A quiet reply (optional)"
            data-testid={`concierge-reply-${msg.id}`}
            className="w-full bg-transparent border border-[#4E1E32] p-3 text-sm text-[#F4E8DA] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300 resize-none placeholder:text-[#7A5C55]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => act("acknowledged")}
              disabled={busy}
              data-testid={`concierge-acknowledge-${msg.id}`}
              className="btn-primary"
            >
              Acknowledge
            </button>
            <button
              type="button"
              onClick={() => act("fulfilled")}
              disabled={busy}
              data-testid={`concierge-fulfill-${msg.id}`}
              className="btn-ghost"
            >
              Mark fulfilled
            </button>
            <button
              type="button"
              onClick={() => act("declined")}
              disabled={busy}
              data-testid={`concierge-decline-${msg.id}`}
              className="overline text-[#B39586] hover:text-[#C08B70] transition-colors duration-300"
            >
              Send regrets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const [venues, setVenues] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [correspondence, setCorrespondence] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState("overview");

  const loadVenues = useCallback(async () => {
    const { data } = await api.get("/staff/venues");
    setVenues(data);
    if (data.length > 0) {
      setSelectedId((prev) => prev || data[0].id);
    }
  }, []);

  const loadData = useCallback(async (vid) => {
    if (!vid) return;
    const [a, r, c, b] = await Promise.all([
      api.get(`/staff/venues/${vid}/analytics`),
      api.get(`/staff/venues/${vid}/redemptions`),
      api.get(`/staff/venues/${vid}/concierge`),
      api.get(`/staff/venues/${vid}/bookings`),
    ]);
    setAnalytics(a.data);
    setRedemptions(r.data);
    setCorrespondence(c.data);
    setBookings(b.data);
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    loadData(selectedId);
  }, [selectedId, loadData]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedId),
    [venues, selectedId],
  );

  const pendingCount = correspondence.filter((c) => c.status === "pending").length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  const updateStatus = async (newStatus) => {
    if (!selectedId) return;
    try {
      await api.patch(`/staff/venues/${selectedId}/status`, { status: newStatus });
      toast.success(`Room set to ${newStatus}.`);
      await loadVenues();
      await loadData(selectedId);
    } catch {
      toast.error("Could not update status.");
    }
  };

  if (!analytics || !selectedVenue) {
    return <div className="mx-auto max-w-4xl px-5 py-16 overline text-center">Loading dashboard…</div>;
  }

  const checkinUrl = `${window.location.origin}/checkin/${selectedVenue.id}`;

  return (
    <div className="mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-14" data-testid="staff-dashboard">
      <div className="flex items-start justify-between gap-4 flex-wrap animate-fade-up">
        <div>
          <div className="overline">Staff dashboard</div>
          <h1 className="font-serif-display text-4xl sm:text-5xl mt-2">
            {selectedVenue.name}
          </h1>
          <div className="mt-1 overline">
            {selectedVenue.type} · {selectedVenue.neighborhood}
          </div>
        </div>

        {venues.length > 1 && (
          <div>
            <div className="overline mb-2">Managing</div>
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              data-testid="venue-select"
              className="bg-[#2E1220] border border-[#4E1E32] py-2 px-3 focus:border-[#C2A36B] outline-none font-light text-[#F4E8DA]"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-10 animate-fade-up delay-100">
        <div className="overline mb-4">Room energy</div>
        <StatusControl current={selectedVenue.status} onChange={updateStatus} />
      </div>

      <div className="mt-14 flex items-center gap-1 border-b border-[#4E1E32] overflow-x-auto" role="tablist">
        {[
          { k: "overview", l: "Overview" },
          { k: "bookings", l: "Bookings", badge: pendingBookings },
          { k: "correspondence", l: "Correspondence", badge: pendingCount },
          { k: "redemptions", l: "Redemptions" },
          { k: "events", l: "Events" },
          { k: "qr", l: "QR Code" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            role="tab"
            data-testid={`tab-${t.k}`}
            className={cn(
              "px-5 py-3 overline transition-colors duration-300 border-b -mb-px whitespace-nowrap inline-flex items-center gap-2",
              tab === t.k
                ? "text-[#C2A36B] border-[#C2A36B]"
                : "text-[#B39586] border-transparent hover:text-[#F4E8DA]",
            )}
          >
            {t.l}
            {t.badge > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[9px] font-medium bg-[#C2A36B] text-[#1A0912]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-10 space-y-10 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Check-ins · week" value={analytics.checkins_week} hint={`${analytics.checkins_total} total`} />
            <StatCard label="Points issued" value={analytics.points_issued.toLocaleString()} />
            <StatCard label="Points redeemed" value={analytics.points_redeemed.toLocaleString()} />
            <StatCard label="Room energy" value={selectedVenue.status} hint={`${selectedVenue.capacity_percent ?? 0}% capacity`} />
          </div>

          <div>
            <div className="overline mb-6">What regulars return for</div>
            {analytics.top_offerings.length === 0 ? (
              <div className="text-[#B39586] font-light">
                No returns recorded yet — check-in feedback will populate this.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.top_offerings.map((o, i) => (
                  <div
                    key={o.name}
                    className="flex items-baseline justify-between border-b border-white/[0.05] pb-3"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="font-serif text-[#C2A36B] tabular-nums w-8">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-serif-display text-xl">{o.name}</span>
                    </div>
                    <div className="overline">{o.return_count} returned</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-10 animate-fade-up" data-testid="staff-bookings-tab">
          {bookings.length === 0 ? (
            <div className="text-[#B39586] font-light py-8">
              No reservations held yet. Members will book from the venue page and appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <BookingRow key={b.id} booking={b} onAct={() => loadData(selectedId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "correspondence" && (
        <div className="mt-10 animate-fade-up">
          {correspondence.length === 0 ? (
            <div className="text-[#B39586] font-light py-8">
              No notes from members yet. When they arrive, you&apos;ll find them here.
            </div>
          ) : (
            <div className="space-y-3">
              {correspondence.map((c) => (
                <CorrespondenceRow key={c.id} msg={c} onRespond={() => loadData(selectedId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "redemptions" && (
        <div className="mt-10 animate-fade-up">
          {redemptions.length === 0 ? (
            <div className="text-[#B39586] font-light py-8">No redemptions held here yet.</div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 p-5 border border-[#4E1E32]"
                  data-testid={`staff-redemption-${r.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-serif-display text-xl">{r.perk_name}</div>
                    <div className="overline mt-1">
                      {r.member_name} · {r.member_tier}
                    </div>
                    <div className="text-xs text-[#7A5C55] mt-1">
                      {new Date(r.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="font-mono tracking-widest text-[#C2A36B] text-sm">{r.code}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "events" && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fade-up">
          <div>
            <div className="overline mb-6">Post an event</div>
            <EventForm venueId={selectedId} onCreated={() => loadData(selectedId)} />
          </div>
          <div>
            <div className="overline mb-6">On the calendar</div>
            <div className="space-y-3">
              {(analytics.venue?.events || []).length === 0 && (
                <div className="text-[#B39586] font-light">No events yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "qr" && (
        <div className="mt-10 animate-fade-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="overline mb-4">Present at the host stand</div>
              <h2 className="font-serif-display text-3xl leading-tight">
                A single QR — every arriving member.
              </h2>
              <p className="text-[#B39586] font-light mt-4 leading-relaxed">
                Display this at the entrance or on the reservation stand. When a
                member scans it in the Table app, they are checked into {selectedVenue.name} and awarded 100
                Table Points.
              </p>
              <div className="mt-6 overline">Check-in address</div>
              <div className="font-mono text-xs sm:text-sm text-[#C2A36B] break-all mt-1">
                {checkinUrl}
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <QRDisplay value={checkinUrl} size={280} label={selectedVenue.name} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
