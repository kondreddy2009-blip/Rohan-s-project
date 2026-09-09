import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Minus, Plus, X, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatusIndicator, queueLabel } from "@/components/StatusIndicator";
import { QRDisplay } from "@/components/QRDisplay";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Quiet", "Filling In", "At Capacity"];

const AVAILABILITY_OPTIONS = [
  { key: "accepting", label: "Accepting walk-ins" },
  { key: "fully_booked", label: "Fully booked" },
  { key: "closed", label: "Closed for the night" },
];

const CONCIERGE_TYPE_LABEL = {
  hold_table: "Hold a table",
  preview_menu: "Preview the menu",
  request: "A request",
};

const STAFF_TABS = ["overview", "profile", "bookings", "correspondence", "redemptions", "loyalty", "events", "qr"];

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

function QueueControl({ current, onChange }) {
  const [busy, setBusy] = useState(false);
  const value = current ?? 0;

  const step = async (delta) => {
    const next = Math.max(0, value + delta);
    if (next === value) return;
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5 p-6 border border-[#4E1E32] bg-[#2E1220]" data-testid="queue-control">
      <button
        onClick={() => step(-1)}
        disabled={busy || value === 0}
        data-testid="queue-decrement"
        aria-label="Decrease waitlist"
        className="h-10 w-10 flex items-center justify-center border border-[#4E1E32] hover:border-[#C2A36B]/50 disabled:opacity-30 transition-colors duration-300"
      >
        <Minus strokeWidth={1.4} className="h-4 w-4" />
      </button>
      <div className="text-center min-w-[7rem]">
        <div className="font-serif-display text-4xl tabular-nums" data-testid="queue-value">
          {value}
        </div>
        <div className="overline mt-1">{queueLabel(value)}</div>
      </div>
      <button
        onClick={() => step(1)}
        disabled={busy}
        data-testid="queue-increment"
        aria-label="Increase waitlist"
        className="h-10 w-10 flex items-center justify-center border border-[#4E1E32] hover:border-[#C2A36B]/50 disabled:opacity-30 transition-colors duration-300"
      >
        <Plus strokeWidth={1.4} className="h-4 w-4" />
      </button>
    </div>
  );
}

function AvailabilityControl({ current, onChange }) {
  const value = current || "accepting";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="availability-control">
      {AVAILABILITY_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          data-testid={`availability-btn-${o.key}`}
          className={cn(
            "px-4 py-4 border transition-colors duration-300 text-left font-serif text-lg",
            value === o.key
              ? "border-[#C2A36B] bg-[#2E1220] text-[#C2A36B]"
              : "border-[#4E1E32] hover:border-[#B39586] text-[#F4E8DA]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WaitMinutesControl({ current, onChange }) {
  const [busy, setBusy] = useState(false);
  const value = current ?? 0;

  const step = async (delta) => {
    const next = Math.max(0, value + delta);
    if (next === value) return;
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5 p-6 border border-[#4E1E32] bg-[#2E1220]" data-testid="wait-minutes-control">
      <button
        onClick={() => step(-5)}
        disabled={busy || value === 0}
        data-testid="wait-minutes-decrement"
        aria-label="Decrease estimated wait"
        className="h-10 w-10 flex items-center justify-center border border-[#4E1E32] hover:border-[#C2A36B]/50 disabled:opacity-30 transition-colors duration-300"
      >
        <Minus strokeWidth={1.4} className="h-4 w-4" />
      </button>
      <div className="text-center min-w-[7rem]">
        <div className="font-serif-display text-4xl tabular-nums" data-testid="wait-minutes-value">
          {value}
        </div>
        <div className="overline mt-1">Minutes est.</div>
      </div>
      <button
        onClick={() => step(5)}
        disabled={busy}
        data-testid="wait-minutes-increment"
        aria-label="Increase estimated wait"
        className="h-10 w-10 flex items-center justify-center border border-[#4E1E32] hover:border-[#C2A36B]/50 disabled:opacity-30 transition-colors duration-300"
      >
        <Plus strokeWidth={1.4} className="h-4 w-4" />
      </button>
    </div>
  );
}

function LastUpdated({ timestamp }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) {
    return <div className="overline text-[#7A5C55]">Not updated yet</div>;
  }

  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  const label =
    minutesAgo === 0 ? "Updated just now" : `Updated ${minutesAgo} min${minutesAgo === 1 ? "" : "s"} ago`;
  const stale = minutesAgo >= 15;

  return (
    <div
      data-testid="last-updated"
      className={cn("overline", stale ? "text-[#C08B70]" : "text-[#7A5C55]")}
    >
      {label}
      {stale && " · check the floor"}
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

function TagListInput({ label, hint, items, onChange, testId }) {
  const [draft, setDraft] = useState("");

  const add = (e) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  };

  const remove = (value) => onChange(items.filter((i) => i !== value));

  return (
    <div>
      <label className="overline block mb-2">{label}</label>
      {hint && <p className="text-xs text-[#7A5C55] mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2 mb-3" data-testid={testId}>
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#4E1E32] text-sm text-[#F4E8DA] font-light"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
              className="text-[#7A5C55] hover:text-[#C08B70] transition-colors duration-300"
            >
              <X strokeWidth={1.4} className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add and press enter"
          className="flex-1 bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-sm transition-colors duration-300 placeholder:text-[#7A5C55]"
        />
        <button type="submit" className="btn-ghost text-sm px-4">
          Add
        </button>
      </form>
    </div>
  );
}

function VenueProfileForm({ venue, onSaved }) {
  const [form, setForm] = useState({
    name: venue.name || "",
    cuisine: venue.cuisine || "",
    price_level: venue.price_level || 2,
    neighborhood: venue.neighborhood || "",
    hours: venue.hours || "",
    tagline: venue.tagline || "",
    description: venue.description || "",
    image_url: venue.image_url || "",
    chef: venue.chef || "",
    vibes: venue.vibes || [],
    regulars_order: venue.regulars_order || [],
  });
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${venue.id}/profile`, {
        ...form,
        price_level: Number(form.price_level),
      });
      toast.success("Venue profile saved.");
      onSaved?.();
    } catch {
      toast.error("Could not save the profile.");
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async () => {
    setPublishBusy(true);
    try {
      await api.patch(`/staff/venues/${venue.id}/publish`, { published: !venue.published });
      toast.success(venue.published ? "Venue unpublished." : "Venue is live on Table.");
      onSaved?.();
    } catch {
      toast.error("Could not update publish status.");
    } finally {
      setPublishBusy(false);
    }
  };

  return (
    <div className="space-y-10" data-testid="venue-profile-tab">
      <div className="flex items-center justify-between gap-4 p-5 border border-[#4E1E32] bg-[#2E1220] flex-wrap">
        <div>
          <div className="overline mb-1">Listing status</div>
          <div className={cn("font-serif-display text-2xl", venue.published ? "text-[#7A9B7A]" : "text-[#B39586]")}>
            {venue.published ? "Live on Table" : "Draft — not visible to guests"}
          </div>
        </div>
        <button
          type="button"
          onClick={togglePublish}
          disabled={publishBusy}
          data-testid="publish-toggle-button"
          className={venue.published ? "btn-ghost" : "btn-primary"}
        >
          {publishBusy ? "One moment" : venue.published ? "Unpublish" : "Publish"}
        </button>
      </div>

      <form onSubmit={submit} className="space-y-6" data-testid="venue-profile-form">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="overline block mb-2">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={set("name")}
              data-testid="profile-name-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
          <div>
            <label className="overline block mb-2">Cuisine</label>
            <input
              type="text"
              value={form.cuisine}
              onChange={set("cuisine")}
              data-testid="profile-cuisine-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
          <div>
            <label className="overline block mb-2">Neighborhood</label>
            <input
              type="text"
              required
              value={form.neighborhood}
              onChange={set("neighborhood")}
              data-testid="profile-neighborhood-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
          <div>
            <label className="overline block mb-2">Hours</label>
            <input
              type="text"
              required
              value={form.hours}
              onChange={set("hours")}
              placeholder="18:00 – 23:00"
              data-testid="profile-hours-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300 placeholder:text-[#7A5C55]"
            />
          </div>
          <div>
            <label className="overline block mb-2">Chef</label>
            <input
              type="text"
              value={form.chef}
              onChange={set("chef")}
              data-testid="profile-chef-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
          <div>
            <label className="overline block mb-2">Price tier</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, price_level: lvl }))}
                  data-testid={`profile-price-${lvl}`}
                  className={cn(
                    "py-2 border transition-colors duration-300 font-serif",
                    Number(form.price_level) === lvl
                      ? "border-[#C2A36B] text-[#C2A36B]"
                      : "border-[#4E1E32] text-[#F4E8DA] hover:border-[#B39586]",
                  )}
                >
                  {"₹".repeat(lvl)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="overline block mb-2">Tagline</label>
          <input
            type="text"
            required
            value={form.tagline}
            onChange={set("tagline")}
            data-testid="profile-tagline-input"
            className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
          />
        </div>

        <div>
          <label className="overline block mb-2">Description</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={set("description")}
            data-testid="profile-description-input"
            className="w-full bg-transparent border border-[#4E1E32] p-3 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300 resize-none"
          />
        </div>

        <div>
          <label className="overline block mb-2">Photo URL</label>
          <input
            type="text"
            required
            value={form.image_url}
            onChange={set("image_url")}
            data-testid="profile-image-input"
            className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
          />
          {form.image_url && (
            <img
              src={form.image_url}
              alt=""
              className="mt-3 h-32 w-full max-w-sm object-cover border border-[#4E1E32]"
            />
          )}
        </div>

        <TagListInput
          label="Tags"
          hint="Shown as pills on Discover — e.g. Date Night, Buzzing, Chef's Pick."
          items={form.vibes}
          onChange={(vibes) => setForm((f) => ({ ...f, vibes }))}
          testId="profile-vibes"
        />

        <TagListInput
          label="What regulars order"
          hint="A short curated list — shown on your venue page."
          items={form.regulars_order}
          onChange={(regulars_order) => setForm((f) => ({ ...f, regulars_order }))}
          testId="profile-regulars-order"
        />

        <button type="submit" disabled={busy} data-testid="profile-save-button" className="btn-primary">
          {busy ? "Saving" : "Save changes"}
        </button>
      </form>
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

function slugify(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function QrSlugEditor({ venue, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(venue.qr_slug || venue.id);
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    setValue(venue.qr_slug || venue.id);
    setEditing(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const slug = slugify(value);
    if (slug.length < 3) {
      toast.error("Check-in address needs at least 3 characters.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${venue.id}/qr-slug`, { qr_slug: slug });
      toast.success("Check-in address updated. The QR code below now reflects it.");
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not update the check-in address.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-6">
        <div className="overline">Check-in address</div>
        <div className="font-mono text-xs sm:text-sm text-[#C2A36B] break-all mt-1">
          {`${window.location.origin}/checkin/${venue.qr_slug || venue.id}`}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          data-testid="qr-slug-edit-button"
          className="overline text-[#B39586] hover:text-[#F4E8DA] transition-colors duration-300 mt-3"
        >
          Edit address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6" data-testid="qr-slug-form">
      <label className="overline block mb-2">Check-in address</label>
      <div className="flex items-center gap-0 flex-wrap">
        <span className="font-mono text-xs sm:text-sm text-[#7A5C55]">
          {`${window.location.origin}/checkin/`}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="qr-slug-input"
          className="flex-1 min-w-[8rem] bg-transparent border-b border-[#4E1E32] py-1 px-1 font-mono text-xs sm:text-sm text-[#F4E8DA] focus:border-[#C2A36B] outline-none transition-colors duration-300"
        />
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={busy} data-testid="qr-slug-save" className="btn-primary">
          {busy ? "One moment" : "Save & regenerate QR"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          data-testid="qr-slug-cancel"
          className="overline text-[#B39586] hover:text-[#F4E8DA] transition-colors duration-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function LoyaltyConfigForm({ venueId, config, stats, onSaved }) {
  const [pointsPerCheckin, setPointsPerCheckin] = useState(config.points_per_checkin);
  const [pointsPerBooking, setPointsPerBooking] = useState(config.points_per_booking);
  const [rewards, setRewards] = useState(config.rewards);
  const [draft, setDraft] = useState({ name: "", description: "", cost: "" });
  const [busy, setBusy] = useState(false);

  const addReward = (e) => {
    e.preventDefault();
    const cost = Number(draft.cost);
    if (!draft.name.trim() || !draft.description.trim() || !cost || cost <= 0) return;
    setRewards((r) => [...r, { name: draft.name.trim(), description: draft.description.trim(), cost }]);
    setDraft({ name: "", description: "", cost: "" });
  };

  const removeReward = (idx) => setRewards((r) => r.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${venueId}/loyalty`, {
        points_per_checkin: Number(pointsPerCheckin) || 0,
        points_per_booking: Number(pointsPerBooking) || 0,
        rewards,
      });
      toast.success("Loyalty program updated.");
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save the loyalty program.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10" data-testid="loyalty-tab">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Members enrolled" value={stats.members_enrolled} />
        <StatCard label="Points issued" value={stats.points_issued.toLocaleString()} />
        <StatCard label="Points redeemed" value={stats.points_redeemed.toLocaleString()} />
      </div>

      <div>
        <div className="overline mb-4">Points earned per visit</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="overline block mb-2">Dining in (check-in)</label>
            <input
              type="number"
              min={0}
              value={pointsPerCheckin}
              onChange={(e) => setPointsPerCheckin(e.target.value)}
              data-testid="loyalty-points-checkin-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
          <div>
            <label className="overline block mb-2">Table booking (seated)</label>
            <input
              type="number"
              min={0}
              value={pointsPerBooking}
              onChange={(e) => setPointsPerBooking(e.target.value)}
              data-testid="loyalty-points-booking-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="overline mb-4">Rewards guests can redeem here</div>
        <p className="text-xs text-[#7A5C55] mb-4">
          Redeemable only at {`your venue — points earned here can't be spent elsewhere.`}
        </p>
        <div className="space-y-3 mb-6">
          {rewards.length === 0 && (
            <div className="text-[#B39586] font-light text-sm">No rewards yet — add one below.</div>
          )}
          {rewards.map((r, idx) => (
            <div
              key={r.id || idx}
              className="flex items-center justify-between gap-4 p-4 border border-[#4E1E32]"
              data-testid={`loyalty-reward-row-${idx}`}
            >
              <div className="min-w-0">
                <div className="font-serif-display text-lg">{r.name}</div>
                <p className="text-sm text-[#B39586] font-light">{r.description}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="overline-accent">{r.cost} pts</span>
                <button
                  type="button"
                  onClick={() => removeReward(idx)}
                  aria-label={`Remove ${r.name}`}
                  data-testid={`loyalty-reward-remove-${idx}`}
                  className="text-[#7A5C55] hover:text-[#C08B70] transition-colors duration-300"
                >
                  <Trash2 strokeWidth={1.4} className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addReward} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="overline block mb-2">Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Free Dessert"
              data-testid="loyalty-reward-name-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-sm transition-colors duration-300 placeholder:text-[#7A5C55]"
            />
          </div>
          <div>
            <label className="overline block mb-2">Cost</label>
            <input
              type="number"
              min={1}
              value={draft.cost}
              onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
              placeholder="150"
              data-testid="loyalty-reward-cost-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-sm transition-colors duration-300 placeholder:text-[#7A5C55]"
            />
          </div>
          <button type="submit" data-testid="loyalty-reward-add-button" className="btn-ghost text-sm px-4 py-2.5">
            Add reward
          </button>
          <div className="sm:col-span-4">
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="A short description guests will see"
              data-testid="loyalty-reward-description-input"
              className="w-full bg-transparent border-b border-[#4E1E32] py-2 focus:border-[#C2A36B] outline-none font-light text-sm transition-colors duration-300 placeholder:text-[#7A5C55]"
            />
          </div>
        </form>
      </div>

      <button type="button" onClick={save} disabled={busy} data-testid="loyalty-save-button" className="btn-primary">
        {busy ? "Saving" : "Save loyalty program"}
      </button>
    </div>
  );
}

function LoyaltyRedemptionRow({ redemption, onToggled }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${redemption.venue_id}/loyalty/redemptions/${redemption.id}`, {
        redeemed: !redemption.redeemed,
      });
      onToggled?.();
    } catch {
      toast.error("Could not update this redemption.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-4 p-5 border border-[#4E1E32]"
      data-testid={`loyalty-redemption-${redemption.id}`}
    >
      <div className="min-w-0">
        <div className="font-serif-display text-xl">{redemption.reward_name}</div>
        <div className="overline mt-1">{redemption.member_name}</div>
        <div className="text-xs text-[#7A5C55] mt-1">
          {new Date(redemption.timestamp).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="font-mono tracking-widest text-[#C2A36B] text-sm">{redemption.code}</div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          data-testid={`loyalty-redemption-toggle-${redemption.id}`}
          className={redemption.redeemed ? "btn-ghost text-sm py-2 px-3" : "btn-primary text-sm py-2 px-3"}
        >
          {redemption.redeemed ? "Redeemed" : "Mark redeemed"}
        </button>
      </div>
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
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyRedemptions, setLoyaltyRedemptions] = useState([]);
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const tab = STAFF_TABS.includes(tabParam) ? tabParam : "overview";
  const setTab = (next) => navigate(next === "overview" ? "/staff" : `/staff/${next}`);

  const loadVenues = useCallback(async () => {
    const { data } = await api.get("/staff/venues");
    setVenues(data);
    if (data.length > 0) {
      setSelectedId((prev) => prev || data[0].id);
    }
  }, []);

  const loadData = useCallback(async (vid) => {
    if (!vid) return;
    const [a, r, c, b, l, lr] = await Promise.all([
      api.get(`/staff/venues/${vid}/analytics`),
      api.get(`/staff/venues/${vid}/redemptions`),
      api.get(`/staff/venues/${vid}/concierge`),
      api.get(`/staff/venues/${vid}/bookings`),
      api.get(`/staff/venues/${vid}/loyalty`),
      api.get(`/staff/venues/${vid}/loyalty/redemptions`),
    ]);
    setAnalytics(a.data);
    setRedemptions(r.data);
    setCorrespondence(c.data);
    setBookings(b.data);
    setLoyalty(l.data);
    setLoyaltyRedemptions(lr.data);
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

  const patchQueue = async (partial) => {
    if (!selectedId || !selectedVenue) return;
    const body = {
      queue_length:
        partial.queue_length !== undefined ? partial.queue_length : selectedVenue.queue_length ?? 0,
      wait_minutes:
        partial.wait_minutes !== undefined ? partial.wait_minutes : selectedVenue.wait_minutes ?? null,
    };
    try {
      await api.patch(`/staff/venues/${selectedId}/queue`, body);
      await loadVenues();
    } catch {
      toast.error("Could not update the waitlist.");
    }
  };

  const updateQueue = (queueLength) => patchQueue({ queue_length: queueLength });
  const updateWaitMinutes = (minutes) => patchQueue({ wait_minutes: minutes });

  const updateAvailability = async (availability) => {
    if (!selectedId) return;
    try {
      await api.patch(`/staff/venues/${selectedId}/availability`, { availability });
      toast.success("Availability updated.");
      await loadVenues();
    } catch {
      toast.error("Could not update availability.");
    }
  };

  if (!analytics || !selectedVenue) {
    return <div className="mx-auto max-w-4xl px-5 py-16 overline text-center">Loading dashboard…</div>;
  }

  const checkinUrl = `${window.location.origin}/checkin/${selectedVenue.qr_slug || selectedVenue.id}`;

  return (
    <div data-testid="staff-dashboard">
      <div
        className="hidden sm:flex flex-col gap-1 fixed left-0 top-0 h-screen w-56 pt-24 px-3 border-r border-[#4E1E32] bg-[#1A0912] z-30 overflow-y-auto"
        role="tablist"
      >
        {[
          { k: "overview", l: "Overview" },
          { k: "profile", l: "Venue Profile" },
          { k: "bookings", l: "Bookings", badge: pendingBookings },
          { k: "correspondence", l: "Correspondence", badge: pendingCount },
          { k: "redemptions", l: "Redemptions" },
          { k: "loyalty", l: "Loyalty" },
          { k: "events", l: "Events" },
          { k: "qr", l: "QR Code" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            role="tab"
            data-testid={`tab-${t.k}`}
            className={cn(
              "px-4 py-2.5 overline transition-colors duration-300 border-l-2 -ml-px text-left whitespace-nowrap inline-flex items-center gap-2",
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

      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-14 sm:pl-[15.5rem]">
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

      <div className="mt-14 flex sm:hidden items-center gap-1 border-b border-[#4E1E32] overflow-x-auto" role="tablist">
        {[
          { k: "overview", l: "Overview" },
          { k: "profile", l: "Venue Profile" },
          { k: "bookings", l: "Bookings", badge: pendingBookings },
          { k: "correspondence", l: "Correspondence", badge: pendingCount },
          { k: "redemptions", l: "Redemptions" },
          { k: "loyalty", l: "Loyalty" },
          { k: "events", l: "Events" },
          { k: "qr", l: "QR Code" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            role="tab"
            data-testid={`tab-${t.k}-mobile`}
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

      <div className="mt-10 sm:mt-14">
      {tab === "overview" && (
        <div className="mt-10 space-y-10 animate-fade-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="overline">Live floor</div>
            <LastUpdated timestamp={selectedVenue.last_status_update} />
          </div>

          <div>
            <div className="overline mb-4">Room energy</div>
            <StatusControl current={selectedVenue.status} onChange={updateStatus} />
          </div>

          <div>
            <div className="overline mb-4">Availability</div>
            <AvailabilityControl current={selectedVenue.availability} onChange={updateAvailability} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="overline mb-4">Waitlist</div>
              <QueueControl current={selectedVenue.queue_length} onChange={updateQueue} />
            </div>
            <div>
              <div className="overline mb-4">Estimated wait</div>
              <WaitMinutesControl current={selectedVenue.wait_minutes} onChange={updateWaitMinutes} />
            </div>
          </div>

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

      {tab === "profile" && (
        <div className="mt-10 animate-fade-up">
          <VenueProfileForm
            key={selectedVenue.id}
            venue={selectedVenue}
            onSaved={() => {
              loadVenues();
              loadData(selectedId);
            }}
          />
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

      {tab === "loyalty" && loyalty && (
        <div className="mt-10 space-y-12 animate-fade-up">
          <LoyaltyConfigForm
            key={selectedVenue.id}
            venueId={selectedId}
            config={loyalty.config}
            stats={loyalty}
            onSaved={() => loadData(selectedId)}
          />
          <div className="hairline-t pt-10">
            <div className="overline mb-6">Rewards to fulfill</div>
            {loyaltyRedemptions.length === 0 ? (
              <div className="text-[#B39586] font-light py-8">No loyalty redemptions here yet.</div>
            ) : (
              <div className="space-y-3">
                {loyaltyRedemptions.map((r) => (
                  <LoyaltyRedemptionRow key={r.id} redemption={r} onToggled={() => loadData(selectedId)} />
                ))}
              </div>
            )}
          </div>
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
              <QrSlugEditor
                key={selectedVenue.id}
                venue={selectedVenue}
                onSaved={() => {
                  loadVenues();
                  loadData(selectedId);
                }}
              />
            </div>
            <div className="flex justify-center lg:justify-end">
              <QRDisplay value={checkinUrl} size={280} label={selectedVenue.name} />
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
