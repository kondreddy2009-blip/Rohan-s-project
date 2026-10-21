import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Minus, Plus, X, Trash2, LogOut, RefreshCw, LayoutGrid, Store, CalendarDays, Mail, Gift, Star,
  QrCode, ChartNoAxesColumn, Users, Clock, Database, UtensilsCrossed, Armchair, Image as ImageIcon, Lock, MapPin, User, Info, MessageCircle, Sparkles, Search, Filter, ChevronRight, ChevronDown, CircleCheck, CreditCard, CalendarClock, Sun, Moon, Landmark, Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { StatusIndicator, queueLabel } from "@/components/StatusIndicator";
import { QRDisplay } from "@/components/QRDisplay";
import { PayoutDetailsForm } from "@/components/PayoutDetailsForm";
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

const STATUS_DOT = { Quiet: "bg-[#4ADE80]", "Filling In": "bg-[#FACC15]", "At Capacity": "bg-[#F87171]" };

const NAV_ITEMS = [
  { k: "overview", l: "Overview", icon: LayoutGrid },
  { k: "profile", l: "Venue Profile", icon: Store },
  { k: "bookings", l: "Bookings", icon: CalendarDays },
  { k: "correspondence", l: "Correspondence", icon: Mail },
  { k: "redemptions", l: "Redemptions", icon: Gift },
  { k: "loyalty", l: "Loyalty", icon: Star },
  { k: "events", l: "Events", icon: CalendarDays },
  { k: "qr", l: "QR Code", icon: QrCode },
  { k: "payouts", l: "Payouts", icon: Landmark },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function Panel({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6">
      <div className="flex items-center gap-4 mb-5">
        <Icon strokeWidth={1.5} className="h-6 w-6 text-[color:var(--st-gold)]" />
        <div className="overline text-[color:var(--st-text)]">{title}</div>
      </div>
      {children}
    </section>
  );
}

const STAFF_TABS = ["overview", "profile", "bookings", "correspondence", "redemptions", "loyalty", "events", "qr", "payouts"];

const BOOKING_STATUS_COLOR = {
  pending: "text-[color:var(--st-muted)]",
  confirmed: "text-[color:var(--st-gold)]",
  declined: "text-[color:var(--st-warn)]",
  seated: "text-[color:var(--st-ok)]",
  cancelled: "text-[color:var(--st-faint)]",
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
      className="p-6 sm:p-8 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)]"
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
            <span className="text-[color:var(--st-gold)]">· {booking.member_tier}</span>
          </div>
        </div>
        <div className={cn("text-xs tracking-widest uppercase", BOOKING_STATUS_COLOR[booking.status])}>
          {booking.status}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-3 flex-wrap">
        <div className="overline">Code</div>
        <div className="font-mono tracking-[0.28em] text-[color:var(--st-gold)] text-sm">{booking.code}</div>
        {booking.payment_status === "paid" && (
          <span className="overline text-[color:var(--st-ok)]">₹{booking.deposit_amount} deposit paid</span>
        )}
        {booking.payment_status === "refunded" && (
          <span className="overline text-[color:var(--st-muted)]">₹{booking.deposit_amount} deposit refunded</span>
        )}
      </div>

      {booking.note && (
        <p className="mt-3 font-serif italic text-[color:var(--st-text)] leading-relaxed">
          {`"${booking.note}"`}
        </p>
      )}

      {booking.staff_reply && !isPending && (
        <div className="mt-4 pt-4 border-t border-[color:var(--st-border)]">
          <div className="overline-accent mb-1">Your reply</div>
          <p className="text-sm text-[color:var(--st-text)] font-light">{booking.staff_reply}</p>
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
            className="w-full bg-transparent border border-[color:var(--st-border)] p-3 text-sm text-[color:var(--st-text)] font-light focus:border-[color:var(--st-gold)] outline-none transition-colors duration-300 resize-none placeholder:text-[color:var(--st-faint)]"
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
              className="overline text-[color:var(--st-muted)] hover:text-[color:var(--st-warn)] transition-colors duration-300"
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

function BookingDepositControl({ venueId, amount, onSaved }) {
  const [value, setValue] = useState(amount || 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${venueId}/booking-deposit`, { amount: Number(value) || 0 });
      toast.success("Deposit requirement updated.");
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save the deposit amount.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-[color:var(--st-dep-border)] bg-gradient-to-r from-[color:var(--st-dep-from)] to-[color:var(--st-dep-to)] p-6 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 items-start"
      data-testid="booking-deposit-control"
    >
      <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-[color:var(--st-dep-circle)]">
        <CreditCard strokeWidth={1.5} className="h-8 w-8 text-[color:var(--st-dep-icon)]" />
      </span>
      <div>
        <label htmlFor="deposit" className="block text-sm font-semibold tracking-[0.15em] uppercase text-[color:var(--st-text)]">
          Deposit required per booking (₹)
        </label>
        <p className="mt-2 text-[15px] text-[color:var(--st-soft)]">
          Charged via Razorpay when a guest reserves a table, adjusted against their final bill.
        </p>
        <input
          id="deposit"
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="booking-deposit-input"
          className="mt-4 w-full max-w-md rounded-xl border border-[color:var(--st-dep-fieldborder)] bg-[color:var(--st-dep-field)] px-5 py-4 text-lg outline-none focus:border-[color:var(--st-gold)] transition-colors"
        />
      </div>
      <div className="flex flex-col gap-4 lg:items-stretch lg:w-60">
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--st-dep-border)] bg-[color:var(--st-dep-note)] px-4 py-3 text-sm text-[color:var(--st-soft)]">
          <Info strokeWidth={1.4} className="h-5 w-5 shrink-0 text-[color:var(--st-dep-icon)]" />
          Set to 0 to require no deposit.
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="booking-deposit-save"
          className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-8 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition"
        >
          {busy ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

function StatusControl({ current, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="status-control">
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          data-testid={`status-btn-${s.replace(/\s+/g, "-").toLowerCase()}`}
          className={cn(
            "px-3 sm:px-5 py-5 sm:py-6 rounded-xl border transition-colors duration-300 text-left",
            current === s
              ? "border-[color:var(--st-gold)] bg-[color:var(--st-sel)]"
              : "border-[color:var(--st-border)] bg-[color:var(--st-inner)] hover:border-[color:var(--st-muted)]",
          )}
        >
          <span className={cn("block h-2.5 w-2.5 rounded-full", STATUS_DOT[s])} />
          <div className="mt-4 text-[17px] font-medium text-[color:var(--st-text)]">
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
    <div className="flex items-center justify-between gap-6 px-8 py-6 rounded-xl bg-[color:var(--st-inner)]" data-testid="queue-control">
      <button
        onClick={() => step(-1)}
        disabled={busy || value === 0}
        data-testid="queue-decrement"
        aria-label="Decrease waitlist"
        className="h-14 w-14 flex items-center justify-center rounded-xl bg-[color:var(--st-border)] text-[color:var(--st-gold)] hover:bg-[color:var(--st-hover)] disabled:opacity-30 transition-colors duration-300"
      >
        <Minus strokeWidth={1.4} className="h-4 w-4" />
      </button>
      <div className="text-center min-w-[8rem]">
        <div className="text-4xl font-bold tabular-nums" data-testid="queue-value">
          {value}
        </div>
        <div className="overline mt-2">{queueLabel(value)}</div>
      </div>
      <button
        onClick={() => step(1)}
        disabled={busy}
        data-testid="queue-increment"
        aria-label="Increase waitlist"
        className="h-14 w-14 flex items-center justify-center rounded-xl bg-[color:var(--st-border)] text-[color:var(--st-gold)] hover:bg-[color:var(--st-hover)] disabled:opacity-30 transition-colors duration-300"
      >
        <Plus strokeWidth={1.4} className="h-4 w-4" />
      </button>
    </div>
  );
}

function AvailabilityControl({ current, onChange }) {
  const value = current || "accepting";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="availability-control">
      {AVAILABILITY_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          data-testid={`availability-btn-${o.key}`}
          className={cn(
            "px-4 sm:px-5 py-5 sm:py-6 rounded-xl border transition-colors duration-300 text-left text-base sm:text-[17px] font-medium",
            value === o.key
              ? "border-[color:var(--st-gold)] bg-[color:var(--st-sel)] text-[color:var(--st-text)]"
              : "border-[color:var(--st-border)] bg-[color:var(--st-inner)] hover:border-[color:var(--st-muted)] text-[color:var(--st-text)]",
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
    <div className="flex items-center justify-between gap-6 px-8 py-6 rounded-xl bg-[color:var(--st-inner)]" data-testid="wait-minutes-control">
      <button
        onClick={() => step(-5)}
        disabled={busy || value === 0}
        data-testid="wait-minutes-decrement"
        aria-label="Decrease estimated wait"
        className="h-14 w-14 flex items-center justify-center rounded-xl bg-[color:var(--st-border)] text-[color:var(--st-gold)] hover:bg-[color:var(--st-hover)] disabled:opacity-30 transition-colors duration-300"
      >
        <Minus strokeWidth={1.4} className="h-4 w-4" />
      </button>
      <div className="text-center min-w-[8rem]">
        <div className="text-4xl font-bold tabular-nums" data-testid="wait-minutes-value">
          {value}
        </div>
        <div className="overline mt-2">Minutes est.</div>
      </div>
      <button
        onClick={() => step(5)}
        disabled={busy}
        data-testid="wait-minutes-increment"
        aria-label="Increase estimated wait"
        className="h-14 w-14 flex items-center justify-center rounded-xl bg-[color:var(--st-border)] text-[color:var(--st-gold)] hover:bg-[color:var(--st-hover)] disabled:opacity-30 transition-colors duration-300"
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
    return <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-[#D9D2C6]">Not updated yet</div>;
  }

  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  const label =
    minutesAgo === 0 ? "Updated just now" : `Updated ${minutesAgo} min${minutesAgo === 1 ? "" : "s"} ago`;
  const stale = minutesAgo >= 15;

  return (
    <div
      data-testid="last-updated"
      className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur px-4 py-2 text-xs font-semibold text-[#F4F1EC]"
    >
      {label}
      {stale && " · Check the floor"}
      <RefreshCw strokeWidth={2} className="h-3.5 w-3.5" />
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="p-6 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)]">
      <div className="overline mb-4">{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="overline mt-3">{hint}</div>}
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
      <label className="block mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--st-gold)]">{label}</label>
      {hint && <p className="text-xs text-[color:var(--st-faint)] mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2 mb-3" data-testid={testId}>
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[color:var(--st-border)] bg-[color:var(--st-card)] text-sm text-[color:var(--st-text)]"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
              className="text-[color:var(--st-faint)] hover:text-[color:var(--st-warn)] transition-colors duration-300"
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
          className="flex-1 rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-4 py-2.5 focus:border-[color:var(--st-gold)] outline-none text-sm transition-colors duration-300 placeholder:text-[color:var(--st-faint)]"
        />
        <button type="submit" className="btn-ghost text-sm px-4 rounded-xl">
          Add
        </button>
      </form>
    </div>
  );
}

function PublishCard({ venue, onSaved }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/staff/venues/${venue.id}/publish`, { published: !venue.published });
      toast.success(venue.published ? "Venue unpublished." : "Venue is live on Table.");
      onSaved?.();
    } catch {
      toast.error("Could not update publish status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 w-full sm:w-auto rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-5 sm:px-6 py-4">
      <div>
        <div className="flex items-center gap-2.5 font-medium">
          <span className={cn("h-2.5 w-2.5 rounded-full", venue.published ? "bg-[#4ADE80]" : "bg-[color:var(--st-faint)]")} />
          {venue.published ? "Live on Table" : "Draft"}
        </div>
        <div className="mt-1 text-sm text-[color:var(--st-muted)]">
          {venue.published ? "Your venue is visible to members." : "Not visible to guests."}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-testid="publish-toggle-button"
        className={cn(
          "rounded-xl px-6 py-3 text-xs font-semibold tracking-[0.18em] uppercase transition disabled:opacity-50",
          venue.published
            ? "border border-[color:var(--st-gold)] text-[color:var(--st-text)] hover:bg-[rgb(var(--st-gold-rgb)/0.1)]"
            : "bg-gradient-to-r from-[#D9B06A] to-[#B8904F] text-[#1A1308] hover:brightness-110",
        )}
      >
        {busy ? "One moment" : venue.published ? "Unpublish" : "Publish"}
      </button>
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

  const box =
    "w-full rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] py-3.5 pr-4 text-[15px] text-[color:var(--st-text)] outline-none focus:border-[color:var(--st-gold)] transition-colors placeholder:text-[color:var(--st-faint)]";
  const label = "block mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--st-gold)]";
  const renderField = ({ icon: Icon, name, testId, required, placeholder }) => (
    <div className="relative">
      <Icon strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
      <input
        type="text"
        required={required}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        data-testid={testId}
        className={cn(box, "pl-12")}
      />
    </div>
  );

  return (
    <div data-testid="venue-profile-tab">
      <form onSubmit={submit} className="space-y-6" data-testid="venue-profile-form">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <div>
            <label className={label}>Venue name</label>
            {renderField({ icon: Store, name: "name", required: true, testId: "profile-name-input" })}
          </div>
          <div>
            <label className={label}>Cuisine type</label>
            {renderField({ icon: UtensilsCrossed, name: "cuisine", testId: "profile-cuisine-input" })}
          </div>
          <div>
            <label className={label}>Neighborhood</label>
            {renderField({ icon: MapPin, name: "neighborhood", required: true, testId: "profile-neighborhood-input" })}
          </div>
          <div>
            <label className={label}>Hours</label>
            {renderField({ icon: Clock, name: "hours", required: true, placeholder: "18:00 – 23:00", testId: "profile-hours-input" })}
          </div>
          <div>
            <label className={label}>Chef</label>
            {renderField({ icon: User, name: "chef", testId: "profile-chef-input" })}
          </div>
          <div>
            <label className={label}>Price tier</label>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, price_level: lvl }))}
                  data-testid={`profile-price-${lvl}`}
                  className={cn(
                    "rounded-xl border py-3.5 font-medium transition-colors duration-300",
                    Number(form.price_level) === lvl
                      ? "border-[color:var(--st-gold)] bg-gradient-to-r from-[#D9B06A] to-[#B8904F] text-[#1A1308]"
                      : "border-[color:var(--st-border)] bg-[color:var(--st-card)] text-[color:var(--st-text)] hover:border-[color:var(--st-muted)]",
                  )}
                >
                  {"₹".repeat(lvl)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={label}>Tagline</label>
          <div className="relative">
            <input
              type="text"
              required
              maxLength={140}
              value={form.tagline}
              onChange={set("tagline")}
              data-testid="profile-tagline-input"
              className={cn(box, "pl-5 pr-20")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[color:var(--st-faint)] tabular-nums">
              {form.tagline.length}/140
            </span>
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <div className="relative">
            <textarea
              required
              rows={4}
              maxLength={1000}
              value={form.description}
              onChange={set("description")}
              data-testid="profile-description-input"
              className={cn(box, "pl-5 resize-none pb-8")}
            />
            <span className="absolute right-4 bottom-3 text-xs text-[color:var(--st-faint)] tabular-nums">
              {form.description.length}/1000
            </span>
          </div>
        </div>

        <div>
          <label className={label}>Photo URL</label>
          <input
            type="text"
            required
            value={form.image_url}
            onChange={set("image_url")}
            data-testid="profile-image-input"
            className={cn(box, "pl-5")}
          />
          {form.image_url && (
            <img
              src={form.image_url}
              alt=""
              className="mt-3 h-32 w-full max-w-sm rounded-xl object-cover border border-[color:var(--st-border)]"
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

        <button
          type="submit"
          disabled={busy}
          data-testid="profile-save-button"
          className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-10 py-4 text-xs font-semibold tracking-[0.18em] uppercase text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition"
        >
          {busy ? "Saving" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

const TIER_LABEL = {
  "": "Open to all members",
  Regular: "Regular and above",
  Insider: "Insider and above",
  "Inner Circle": "Inner Circle only",
};

function EventForm({ venueId, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tier, setTier] = useState("");
  const [imageUrl, setImageUrl] = useState("");
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
        image_url: imageUrl.trim() || null,
      });
      toast.success("Event posted.");
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setTier("");
      setImageUrl("");
      onCreated?.();
    } catch {
      toast.error("Could not post that event.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-4 py-3.5 text-[15px] text-[color:var(--st-text)] outline-none focus:border-[color:var(--st-gold)] transition-colors placeholder:text-[color:var(--st-faint)]";
  const label = "text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--st-muted)]";
  const prettyDate = date
    ? new Date(`${date}T00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "";
  const dateTime = [prettyDate, time].filter(Boolean).join(" · ") || "Date & time";

  return (
    <form onSubmit={submit} className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-10 items-start" data-testid="event-form">
      <div className="space-y-7">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className={label}>Event title</label>
            <span className="text-sm text-[color:var(--st-muted)] tabular-nums">{title.length}/80</span>
          </div>
          <input
            type="text"
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wine Tasting Night"
            data-testid="event-title-input"
            className={field}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className={label}>Description</label>
            <span className="text-sm text-[color:var(--st-muted)] tabular-nums">{description.length}/300</span>
          </div>
          <textarea
            required
            rows={4}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell guests what to expect..."
            data-testid="event-description-input"
            className={cn(field, "resize-none")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={cn(label, "block mb-2")}>Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="event-date-input"
              className={field}
            />
          </div>
          <div>
            <label className={cn(label, "block mb-2")}>Time</label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              data-testid="event-time-input"
              className={field}
            />
          </div>
        </div>
        <div>
          <label className={cn(label, "block mb-2")}>Tier gate (optional)</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            data-testid="event-tier-select"
            className={field}
          >
            {Object.entries(TIER_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          data-testid="event-submit-button"
          className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-12 py-4 font-semibold text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition"
        >
          {busy ? "Posting" : "Post event"}
        </button>
      </div>

      <aside className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6" data-testid="event-preview">
        <div className="font-semibold">Event preview</div>
        <div className="mt-5 grid aspect-video place-items-center overflow-hidden rounded-xl bg-[color:var(--st-field2)]">
          {imageUrl.trim() ? (
            <img src={imageUrl.trim()} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="text-center text-[color:var(--st-muted)]">
              <ImageIcon strokeWidth={1.4} className="mx-auto h-8 w-8" />
              <div className="mt-2 text-[15px]">Add event image (optional)</div>
              <div className="text-xs text-[color:var(--st-faint)] mt-1">Recommended 16:9</div>
            </div>
          )}
        </div>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Paste an image link"
          data-testid="event-image-input"
          className={cn(field, "mt-3 py-2.5 text-sm")}
        />
        <div className="mt-6 flex items-center gap-3 text-sm text-[color:var(--st-faint)]">
          <CalendarDays strokeWidth={1.5} className="h-5 w-5" />
          {dateTime}
        </div>
        <div className="mt-3 text-2xl font-bold break-words">{title || "Event title"}</div>
        <p className="mt-3 text-[color:var(--st-soft)] break-words">{description || "Event description will appear here..."}</p>
        <div className="mt-5 border-t border-[color:var(--st-border)] pt-5 flex items-center gap-3 text-[color:var(--st-soft)]">
          <Lock strokeWidth={1.5} className="h-5 w-5" />
          {TIER_LABEL[tier]}
        </div>
      </aside>
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
      ? "text-[color:var(--st-gold)]"
      : msg.status === "declined"
        ? "text-[color:var(--st-warn)]"
        : msg.status === "fulfilled"
          ? "text-[color:var(--st-ok)]"
          : "text-[color:var(--st-muted)]";

  return (
    <div
      className="p-6 sm:p-8 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)]"
      data-testid={`concierge-row-${msg.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="overline">{CONCIERGE_TYPE_LABEL[msg.request_type] || "Note"}</div>
          <div className="font-serif-display text-xl mt-1">
            {msg.member_name} · <span className="text-[color:var(--st-gold)]">{msg.member_tier}</span>
          </div>
        </div>
        <div className={`text-xs tracking-widest uppercase ${statusColor}`}>
          {msg.status}
        </div>
      </div>

      <p className="mt-4 font-serif italic text-[color:var(--st-text)] leading-relaxed">
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
        <div className="mt-4 pt-4 border-t border-[color:var(--st-border)]">
          <div className="overline-accent mb-1">Your reply</div>
          <p className="text-sm text-[color:var(--st-text)] font-light">{msg.response}</p>
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
            className="w-full bg-transparent border border-[color:var(--st-border)] p-3 text-sm text-[color:var(--st-text)] font-light focus:border-[color:var(--st-gold)] outline-none transition-colors duration-300 resize-none placeholder:text-[color:var(--st-faint)]"
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
              className="overline text-[color:var(--st-muted)] hover:text-[color:var(--st-warn)] transition-colors duration-300"
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
        <div className="font-mono text-xs sm:text-sm text-[color:var(--st-gold)] break-all mt-1">
          {`${window.location.origin}/checkin/${venue.qr_slug || venue.id}`}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          data-testid="qr-slug-edit-button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[color:var(--st-gold)] bg-[color:var(--st-gold)]/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-[color:var(--st-gold)] hover:bg-[color:var(--st-gold)] hover:text-[#1A1409] transition-colors duration-300"
        >
          <Pencil strokeWidth={2} className="h-4 w-4" />
          Edit address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6" data-testid="qr-slug-form">
      <label className="overline block mb-2">Check-in address</label>
      <div className="flex items-center gap-0 flex-wrap">
        <span className="font-mono text-xs sm:text-sm text-[color:var(--st-faint)]">
          {`${window.location.origin}/checkin/`}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="qr-slug-input"
          className="flex-1 min-w-[8rem] bg-transparent border-b border-[color:var(--st-border)] py-1 px-1 font-mono text-xs sm:text-sm text-[color:var(--st-text)] focus:border-[color:var(--st-gold)] outline-none transition-colors duration-300"
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
          className="overline text-[color:var(--st-muted)] hover:text-[color:var(--st-text)] transition-colors duration-300"
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
    if (!draft.name.trim() || !cost || cost <= 0) return;
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

  const field =
    "w-full rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-side)] px-4 py-3.5 text-[15px] outline-none focus:border-[color:var(--st-gold)] transition-colors placeholder:text-[color:var(--st-faint)]";

  const LoyaltyStat = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-5 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[rgb(var(--st-gold-rgb)/0.4)] bg-[rgb(var(--st-gold-rgb)/0.05)]">
        <Icon strokeWidth={1.4} className="h-7 w-7 text-[color:var(--st-gold)]" />
      </span>
      <div>
        <div className="text-[15px] text-[color:var(--st-muted)]">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-10" data-testid="loyalty-tab">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <LoyaltyStat icon={Users} label="Members enrolled" value={stats.members_enrolled} />
        <LoyaltyStat icon={Database} label="Points issued" value={stats.points_issued.toLocaleString()} />
        <LoyaltyStat icon={Gift} label="Points redeemed" value={stats.points_redeemed.toLocaleString()} />
      </div>

      <section>
        <h2 className="text-2xl font-bold">Points per visit</h2>
        <p className="mt-1 text-[color:var(--st-muted)]">Set how many points guests earn for different ways of visiting.</p>
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6 gap-6 lg:gap-0">
          <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 sm:gap-5 lg:pr-8 lg:border-r lg:border-[color:var(--st-border)]">
            <UtensilsCrossed strokeWidth={1.4} className="h-9 w-9 shrink-0 text-[color:var(--st-gold)]" />
            <div className="flex-1">
              <label htmlFor="ppc" className="font-semibold">Dining check-in</label>
              <p className="text-sm text-[color:var(--st-muted)] mt-1">Points awarded when a guest checks in in person.</p>
            </div>
            <input
              id="ppc"
              type="number"
              min={0}
              value={pointsPerCheckin}
              onChange={(e) => setPointsPerCheckin(e.target.value)}
              data-testid="loyalty-points-checkin-input"
              className={cn(field, "w-full sm:w-28")}
            />
          </div>
          <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 sm:gap-5 lg:pl-8">
            <Armchair strokeWidth={1.4} className="h-9 w-9 shrink-0 text-[color:var(--st-gold)]" />
            <div className="flex-1">
              <label htmlFor="ppb" className="font-semibold">Seated booking</label>
              <p className="text-sm text-[color:var(--st-muted)] mt-1">Points awarded for a confirmed table booking.</p>
            </div>
            <input
              id="ppb"
              type="number"
              min={0}
              value={pointsPerBooking}
              onChange={(e) => setPointsPerBooking(e.target.value)}
              data-testid="loyalty-points-booking-input"
              className={cn(field, "w-full sm:w-28")}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Guest rewards</h2>
        <p className="mt-1 text-[color:var(--st-muted)]">
          Create rewards that guests can redeem with their points. Redeemable only at your venue.
        </p>

        {rewards.length > 0 && (
          <div className="mt-5 space-y-3">
            {rewards.map((r, idx) => (
              <div
                key={r.id || idx}
                className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-5 py-4"
                data-testid={`loyalty-reward-row-${idx}`}
              >
                <div className="min-w-0">
                  <div className="font-semibold">{r.name}</div>
                  {r.description && <p className="text-sm text-[color:var(--st-muted)]">{r.description}</p>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-[color:var(--st-gold)] font-semibold">{r.cost} pts</span>
                  <button
                    type="button"
                    onClick={() => removeReward(idx)}
                    aria-label={`Remove ${r.name}`}
                    data-testid={`loyalty-reward-remove-${idx}`}
                    className="text-[color:var(--st-faint)] hover:text-[color:var(--st-warn)] transition-colors duration-300"
                  >
                    <Trash2 strokeWidth={1.4} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={addReward}
          className="mt-5 grid grid-cols-1 xl:grid-cols-[1.4fr_0.6fr_1.4fr_auto] gap-4 items-end rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6"
        >
          <div>
            <label className="block mb-2 text-sm text-[color:var(--st-muted)]">Reward name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Free Dessert"
              data-testid="loyalty-reward-name-input"
              className={field}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm text-[color:var(--st-muted)]">Points cost</label>
            <input
              type="number"
              min={1}
              value={draft.cost}
              onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
              placeholder="150"
              data-testid="loyalty-reward-cost-input"
              className={field}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm text-[color:var(--st-muted)]">Short description (optional)</label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="A special dessert on us."
              data-testid="loyalty-reward-description-input"
              className={field}
            />
          </div>
          <button
            type="submit"
            data-testid="loyalty-reward-add-button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-6 py-3.5 font-semibold text-[#1A1308] hover:brightness-110 transition"
          >
            <Plus strokeWidth={2} className="h-4 w-4" />
            Add reward
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        data-testid="loyalty-save-button"
        className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-10 py-4 font-semibold text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition"
      >
        {busy ? "Saving" : "Save changes"}
      </button>
    </div>
  );
}

function LoyaltyRedemptionRow({ redemption, onToggled, kind = "loyalty" }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const base = kind === "perk" ? "redemptions" : "loyalty/redemptions";
      await api.patch(`/staff/venues/${redemption.venue_id}/${base}/${redemption.id}`, {
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
      className="flex items-center justify-between gap-4 p-6 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)]"
      data-testid={`loyalty-redemption-${redemption.id}`}
    >
      <div className="min-w-0">
        <div className="font-serif-display text-xl">{redemption.reward_name || redemption.perk_name}</div>
        <div className="overline mt-1">
          {redemption.member_name}
          {redemption.member_tier ? ` · ${redemption.member_tier}` : ""}
        </div>
        <div className="text-xs text-[color:var(--st-faint)] mt-1">
          {new Date(redemption.timestamp).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="font-mono tracking-widest text-[color:var(--st-gold)] text-sm">{redemption.code}</div>
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

function RedemptionsTab({ venue, perkRedemptions, loyaltyRedemptions, onChanged, goTab }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");

  // Normalise both kinds: venue loyalty rewards (staff can mark these redeemed) and cross-venue perks (read-only).
  const items = useMemo(
    () => [
      ...loyaltyRedemptions.map((r) => ({ ...r, kind: "loyalty", title: r.reward_name })),
      ...perkRedemptions.map((r) => ({ ...r, kind: "perk", title: r.perk_name })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [perkRedemptions, loyaltyRedemptions],
  );

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const pending = items.filter((r) => !r.redeemed).length;
  const redeemedToday = items.filter((r) => r.redeemed_at && new Date(r.redeemed_at).getTime() >= startOfToday).length;
  const totalRedeemed = items.filter((r) => r.redeemed).length;

  const rangeStart = { today: startOfToday, week: Date.now() - 7 * 864e5, month: Date.now() - 30 * 864e5 }[range];
  const q = query.trim().toLowerCase();
  const visible = items.filter((r) => {
    if (status === "pending" && r.redeemed) return false;
    if (status === "redeemed" && !r.redeemed) return false;
    if (rangeStart && new Date(r.timestamp).getTime() < rangeStart) return false;
    if (q && ![r.title, r.member_name, r.code].some((v) => (v || "").toLowerCase().includes(q))) return false;
    return true;
  });

  const stats = [
    { icon: Clock, label: "Pending", value: pending, onClick: () => { setStatus("pending"); setRange("all"); } },
    { icon: CircleCheck, label: "Redeemed today", value: redeemedToday, onClick: () => { setStatus("redeemed"); setRange("today"); } },
    { icon: Gift, label: "Total redeemed", value: totalRedeemed, onClick: () => { setStatus("redeemed"); setRange("all"); } },
  ];
  const box =
    "w-full rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] py-3.5 text-[15px] text-[color:var(--st-text)] outline-none focus:border-[color:var(--st-gold)] transition-colors placeholder:text-[color:var(--st-faint)]";

  return (
    <div className="space-y-6 animate-fade-up" data-testid="redemptions-tab">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {stats.map((st) => (
          <button
            key={st.label}
            type="button"
            onClick={st.onClick}
            className="flex items-center gap-5 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-5 text-left hover:border-[rgb(var(--st-gold-rgb)/0.5)] transition-colors"
          >
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[rgb(var(--st-gold-rgb)/0.1)]">
              <st.icon strokeWidth={1.4} className="h-7 w-7 text-[color:var(--st-gold)]" />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--st-muted)]">{st.label}</span>
              <span className="block mt-1 text-3xl font-bold tabular-nums">{st.value}</span>
            </span>
            <ChevronRight strokeWidth={1.5} className="h-5 w-5 text-[color:var(--st-muted)]" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-4">
        <div className="relative">
          <Search strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member or reward"
            data-testid="redemptions-search"
            className={`${box} pl-12 pr-4`}
          />
        </div>
        <div className="relative">
          <Filter strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            data-testid="redemptions-status"
            className={`${box} appearance-none pl-12 pr-10`}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="redeemed">Redeemed</option>
          </select>
          <ChevronDown strokeWidth={1.5} className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
        </div>
        <div className="relative">
          <CalendarDays strokeWidth={1.5} className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            data-testid="redemptions-range"
            className={`${box} appearance-none pl-12 pr-10`}
          >
            <option value="all">Select date range</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          <ChevronDown strokeWidth={1.5} className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--st-muted)]" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-8 pt-12 pb-8 text-center" data-testid="redemptions-empty">
          <div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full bg-[rgb(var(--st-gold-rgb)/0.1)]">
            <Gift strokeWidth={1.3} className="h-14 w-14 text-[color:var(--st-gold)]" />
            <Sparkles strokeWidth={1.2} className="absolute -left-7 top-2 h-4 w-4 text-[rgb(var(--st-gold-rgb)/0.6)]" />
            <Sparkles strokeWidth={1.2} className="absolute -right-7 top-6 h-4 w-4 text-[rgb(var(--st-gold-rgb)/0.6)]" />
          </div>
          <h2 className="font-serif-display text-4xl font-medium mt-8">No redemptions yet</h2>
          <p className="mt-3 text-lg text-[color:var(--st-soft)]">
            When members redeem rewards at {venue.name}, their activity will appear here.
          </p>
          <button
            type="button"
            onClick={() => goTab("loyalty")}
            data-testid="redemptions-manage-rewards"
            className="mt-8 rounded-xl border border-[color:var(--st-gold)] px-8 py-3.5 font-medium text-[color:var(--st-gold)] hover:bg-[rgb(var(--st-gold-rgb)/0.1)] transition-colors"
          >
            Manage rewards
          </button>
          <div className="mx-auto mt-8 max-w-xl border-t border-[color:var(--st-border)] pt-6 flex items-center justify-center gap-3 text-sm text-[color:var(--st-muted)]">
            <Info strokeWidth={1.4} className="h-5 w-5 shrink-0" />
            <span>
              Create rewards in <span className="text-[color:var(--st-gold)]">Loyalty</span> to give members something to redeem.
            </span>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-10 text-center text-[color:var(--st-muted)]">
          No redemptions match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((r) =>
            r.kind === "loyalty" ? (
              <LoyaltyRedemptionRow key={r.id} redemption={r} onToggled={onChanged} />
            ) : (
              <LoyaltyRedemptionRow key={r.id} redemption={r} onToggled={onChanged} kind="perk" />
            ),
          )}
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
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyRedemptions, setLoyaltyRedemptions] = useState([]);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("staff-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  // Theme tokens live in index.css under html.staff-light; scope the class to the staff area only.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("staff-light", theme === "light");
    root.style.colorScheme = theme;
    try {
      localStorage.setItem("staff-theme", theme);
    } catch {
      /* ignore */
    }
    return () => {
      root.classList.remove("staff-light");
      root.style.colorScheme = "";
    };
  }, [theme]);
  const { tab: tabParam } = useParams();
  const tab = STAFF_TABS.includes(tabParam) ? tabParam : "overview";
  const mobileTabsRef = useRef(null);
  useEffect(() => {
    mobileTabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);
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
    <div data-testid="staff-dashboard" className="staff-scope">
      <div className="hidden sm:flex flex-col fixed left-0 top-0 h-screen w-[17rem] border-r border-[color:var(--st-border)] bg-[color:var(--st-side)] z-30 overflow-y-auto">
        <div className="flex justify-center py-8 border-b border-[color:var(--st-border)]">
          <BrandLockup />
        </div>
        <div className="flex flex-col gap-2 p-4" role="tablist">
          {NAV_ITEMS.map((t) => {
            const badge = t.k === "bookings" ? pendingBookings : t.k === "correspondence" ? pendingCount : 0;
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                role="tab"
                data-testid={`tab-${t.k}`}
                className={cn(
                  "flex items-center gap-4 rounded-xl px-5 py-3.5 text-[15px] font-medium text-left transition-colors duration-300",
                  tab === t.k
                    ? "bg-gradient-to-r from-[#D9B06A] to-[#B8904F] text-[#1A1308]"
                    : "text-[color:var(--st-soft)] hover:bg-[rgb(var(--st-gold-rgb)/0.08)]",
                )}
              >
                <Icon strokeWidth={1.6} className="h-5 w-5 shrink-0" />
                <span className="flex-1">{t.l}</span>
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-semibold bg-[#D9B06A] text-[#121110]">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-[90rem] px-5 sm:px-10 py-8 sm:py-14 sm:pl-[20.5rem]">
      <div className="flex items-start justify-between gap-x-6 gap-y-4 flex-wrap animate-fade-up">
        <div className="min-w-0 basis-full sm:basis-80 sm:flex-1">
          {(tab === "events" || tab === "profile" || tab === "correspondence" || tab === "redemptions" || tab === "bookings" || tab === "qr" || tab === "payouts") && (
            <div className="overline mb-3">
              {{ events: "Events", profile: "Venue profile", correspondence: "Correspondence", redemptions: "Redemptions", bookings: "Bookings", qr: "QR code", payouts: "Payouts" }[tab]}
            </div>
          )}
          <h1
            className={cn(
              "text-4xl sm:text-5xl tracking-tight",
              tab === "profile" || tab === "correspondence" || tab === "redemptions"
                ? "font-serif-display font-medium sm:text-6xl"
                : "font-extrabold",
            )}
          >
            {tab === "loyalty"
              ? "Loyalty"
              : tab === "events"
              ? "Create an event"
              : tab === "profile"
              ? selectedVenue.name
              : tab === "correspondence"
              ? "Member messages"
              : tab === "redemptions"
              ? "Redemptions"
              : tab === "qr"
              ? "Check-in QR code"
              : tab === "payouts"
              ? "Payout details"
              : `${greeting()}, ${selectedVenue.name}.`}
          </h1>
          <p className="mt-2 text-lg text-[color:var(--st-soft)]">
            {tab === "loyalty"
              ? "Manage points and guest rewards."
              : tab === "correspondence"
              ? "Questions and notes from your guests, all in one place."
              : tab === "redemptions"
              ? "Track rewards claimed by members at your venue."
              : tab === "bookings"
              ? "Manage your table reservations and settings."
              : tab === "qr"
              ? "Display this at your venue so members can check in."
              : tab === "payouts"
              ? "Where Table sends booking deposits collected for your restaurant."
              : tab === "profile"
              ? "Keep your venue details up to date. This information appears to members on Table."
              : tab === "events"
              ? "Share what\u2019s happening at your restaurant."
              : "Here\u2019s what\u2019s happening at your restaurant."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto lg:shrink-0">
          {tab === "profile" && (
            <PublishCard
              venue={selectedVenue}
              onSaved={() => {
                loadVenues();
                loadData(selectedId);
              }}
            />
          )}
          {venues.length > 1 && (
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              data-testid="venue-select"
              aria-label="Managing venue"
              className="bg-[color:var(--st-inner)] border border-[color:var(--st-border)] rounded-xl py-3 px-4 text-base focus:border-[color:var(--st-gold)] outline-none text-[color:var(--st-text)]"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title={theme === "light" ? "Dark theme" : "Light theme"}
            data-testid="theme-toggle"
            className="grid h-11 w-11 sm:h-14 sm:w-14 place-items-center rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] text-[color:var(--st-gold)] hover:border-[color:var(--st-gold)] transition-colors"
          >
            {theme === "light" ? <Moon strokeWidth={1.6} className="h-6 w-6" /> : <Sun strokeWidth={1.6} className="h-6 w-6" />}
          </button>
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            aria-label="Sign out"
            data-testid="staff-logout-button"
            className="hidden sm:grid h-14 w-14 place-items-center rounded-xl border border-[rgb(var(--st-gold-rgb)/0.6)] text-[color:var(--st-gold)] hover:bg-[rgb(var(--st-gold-rgb)/0.1)] transition-colors"
          >
            <LogOut strokeWidth={1.6} className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div ref={mobileTabsRef} className="mt-6 flex sm:hidden items-center gap-1 border-b border-[color:var(--st-border)] overflow-x-auto" role="tablist">
        {NAV_ITEMS.map((t) => {
          const badge = t.k === "bookings" ? pendingBookings : t.k === "correspondence" ? pendingCount : 0;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              role="tab"
              aria-selected={tab === t.k}
              data-testid={`tab-${t.k}-mobile`}
              className={cn(
                "px-5 py-3 overline transition-colors duration-300 border-b -mb-px whitespace-nowrap inline-flex items-center gap-2",
                tab === t.k
                  ? "text-[color:var(--st-gold)] border-[color:var(--st-gold)]"
                  : "text-[color:var(--st-muted)] border-transparent hover:text-[color:var(--st-text)]",
              )}
            >
              {t.l}
              {badge > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[9px] font-medium bg-[#D9B06A] text-[#121110]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 sm:mt-14">
      {tab === "overview" && (
        <div className="space-y-6 animate-fade-up">
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--st-border)] bg-[#171614] text-[#F4F1EC] min-h-[15rem] [&_.overline]:text-[#D9D2C6]">
            {selectedVenue.image_url && (
              <img src={selectedVenue.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
            <div className="relative z-10 p-4 pb-0 lg:p-0 lg:absolute lg:top-4 lg:right-4">
              <LastUpdated timestamp={selectedVenue.last_status_update} />
            </div>
            <div className="relative p-8 sm:p-10">
              <div className="overline">Staff dashboard</div>
              <h2 className="font-serif-display text-5xl sm:text-6xl mt-4 font-medium">{selectedVenue.name}</h2>
              <div className="mt-2 text-lg text-[#E4DED3]">
                {selectedVenue.type} · {selectedVenue.neighborhood}
              </div>
              <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-black/50 px-4 py-2.5 text-sm font-medium">
                <span className="h-2 w-2 rounded-full bg-[#4ADE80]" />
                Live floor
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel icon={ChartNoAxesColumn} title="Room energy">
              <StatusControl current={selectedVenue.status} onChange={updateStatus} />
            </Panel>
            <Panel icon={CalendarDays} title="Availability">
              <AvailabilityControl current={selectedVenue.availability} onChange={updateAvailability} />
            </Panel>
            <Panel icon={Users} title="Waitlist">
              <QueueControl current={selectedVenue.queue_length} onChange={updateQueue} />
            </Panel>
            <Panel icon={Clock} title="Estimated wait">
              <WaitMinutesControl current={selectedVenue.wait_minutes} onChange={updateWaitMinutes} />
            </Panel>
          </div>

          <div>
            <div className="overline mb-5">At a glance</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Check-ins · week" value={analytics.checkins_week} hint={`${analytics.checkins_total} total`} />
              <StatCard label="Points issued" value={analytics.points_issued.toLocaleString()} />
              <StatCard label="Points redeemed" value={analytics.points_redeemed.toLocaleString()} />
              <StatCard label="Room energy" value={selectedVenue.status} hint={`${selectedVenue.capacity_percent ?? 0}% capacity`} />
            </div>
          </div>

          <div>
            <div className="overline mb-6">What regulars return for</div>
            {analytics.top_offerings.length === 0 ? (
              <div className="text-[color:var(--st-muted)] font-light p-8 border border-[color:var(--st-border)] bg-[color:var(--st-inner)]">
                No returns recorded yet — check-in feedback will populate this.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.top_offerings.map((o, i) => (
                  <div
                    key={o.name}
                    className="flex items-baseline justify-between border border-[color:var(--st-border)] bg-[color:var(--st-inner)] px-6 py-5"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="font-serif text-[color:var(--st-gold)] tabular-nums w-8">
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
        <div className="mt-12 animate-fade-up">
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
        <div className="space-y-6 animate-fade-up" data-testid="staff-bookings-tab">
          <BookingDepositControl
            key={selectedVenue.id}
            venueId={selectedId}
            amount={selectedVenue.booking_deposit_amount}
            onSaved={() => loadVenues()}
          />
          {bookings.length === 0 ? (
            <div
              className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-8 py-16 text-center"
              data-testid="bookings-empty"
            >
              <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full bg-[rgb(var(--st-gold-rgb)/0.1)]">
                <CalendarClock strokeWidth={1.3} className="h-16 w-16 text-[color:var(--st-gold)]" />
                <Sparkles strokeWidth={1.4} className="absolute -left-8 top-1 h-4 w-4 text-[rgb(var(--st-gold-rgb)/0.7)]" />
                <Sparkles strokeWidth={1.4} className="absolute -right-8 top-8 h-5 w-5 text-[rgb(var(--st-gold-rgb)/0.7)]" />
                <Sparkles strokeWidth={1.4} className="absolute -right-5 bottom-3 h-3 w-3 text-[rgb(var(--st-gold-rgb)/0.6)]" />
              </div>
              <h2 className="font-serif-display text-4xl font-medium mt-8">No reservations yet</h2>
              <p className="mt-3 text-lg text-[color:var(--st-soft)]">Members will book from the venue page and appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <BookingRow key={b.id} booking={b} onAct={() => loadData(selectedId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "correspondence" && (
        <div className="animate-fade-up">
          {correspondence.length === 0 ? (
            <div
              className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-8 pt-12 pb-8 text-center"
              data-testid="correspondence-empty"
            >
              <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full bg-[rgb(var(--st-gold-rgb)/0.1)]">
                <Mail strokeWidth={1.3} className="h-14 w-14 text-[color:var(--st-gold)]" />
                <MessageCircle strokeWidth={1.3} className="absolute -top-1 right-0 h-10 w-10 text-[color:var(--st-gold)] fill-[color:var(--st-card)]" />
                <Sparkles strokeWidth={1.2} className="absolute -left-6 top-6 h-4 w-4 text-[rgb(var(--st-gold-rgb)/0.6)]" />
                <Sparkles strokeWidth={1.2} className="absolute -right-6 bottom-4 h-4 w-4 text-[rgb(var(--st-gold-rgb)/0.6)]" />
              </div>
              <h2 className="font-serif-display text-4xl font-medium mt-8">Your inbox is quiet</h2>
              <p className="mt-3 text-lg text-[color:var(--st-soft)]">When members send a note, you&apos;ll find it here.</p>
              <button
                type="button"
                onClick={() => setTab("bookings")}
                data-testid="correspondence-view-bookings"
                className="mt-8 inline-flex items-center gap-3 rounded-xl border border-[color:var(--st-gold)] px-8 py-3.5 font-medium text-[color:var(--st-gold)] hover:bg-[rgb(var(--st-gold-rgb)/0.1)] transition-colors"
              >
                <CalendarDays strokeWidth={1.5} className="h-5 w-5" />
                View bookings
              </button>
              <div className="mt-8 border-t border-[color:var(--st-border)] pt-6 flex items-center justify-center gap-3 text-sm text-[color:var(--st-muted)]">
                <Info strokeWidth={1.4} className="h-5 w-5 shrink-0" />
                Tip: Check back after service to respond to guest requests.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {correspondence.map((c) => (
                <CorrespondenceRow key={c.id} msg={c} onRespond={() => loadData(selectedId)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "redemptions" && (
        <RedemptionsTab
          venue={selectedVenue}
          perkRedemptions={redemptions}
          loyaltyRedemptions={loyaltyRedemptions}
          onChanged={() => loadData(selectedId)}
          goTab={setTab}
        />
      )}

      {tab === "loyalty" && loyalty && (
        <div className="space-y-14 animate-fade-up">
          <LoyaltyConfigForm
            key={selectedVenue.id}
            venueId={selectedId}
            config={loyalty.config}
            stats={loyalty}
            onSaved={() => loadData(selectedId)}
          />
        </div>
      )}

      {tab === "events" && (
        <div className="animate-fade-up">
          <EventForm venueId={selectedId} onCreated={() => loadData(selectedId)} />
        </div>
      )}

      {tab === "payouts" && <PayoutDetailsForm key={selectedId} venueId={selectedId} />}

      {tab === "qr" && (
        <div className="animate-fade-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-8 sm:p-10">
            <div>
              <div className="overline mb-4">Present at the host stand</div>
              <h2 className="font-serif-display text-3xl leading-tight">
                A single QR — every arriving member.
              </h2>
              <p className="text-[color:var(--st-muted)] font-light mt-4 leading-relaxed">
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
