import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { User, Crown, CalendarDays, BarChart3, Star, Compass, ArrowRight, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

const CONCIERGE_TYPE_LABEL = {
  hold_table: "Hold a table",
  preview_menu: "Preview the menu",
  request: "A request",
};

const CONCIERGE_STATUS_LABEL = {
  pending: "Awaiting the room",
  acknowledged: "The room has replied",
  declined: "Regrets",
  fulfilled: "Fulfilled",
};

const BOOKING_STATUS_LABEL = {
  awaiting_payment: "Payment pending",
  pending: "Awaiting the room",
  confirmed: "Confirmed",
  declined: "Regrets",
  seated: "Seated",
  cancelled: "Cancelled",
};

const BOOKING_STATUS_COLOR = {
  awaiting_payment: "text-[#E8A33D]",
  pending: "text-[#B8B2AA]",
  confirmed: "text-[#EE9B79]",
  declined: "text-[#E8A33D]",
  seated: "text-[#7DBE8A]",
  cancelled: "text-[#8F8781]",
};

const card = "rounded-2xl bg-[#1A1917] border border-white/[0.04] p-6 sm:p-7";
const sectionTitle = "text-2xl font-extrabold tracking-tight text-white";
const sub = "mt-1 text-sm text-[#8F8781]";

function IconCircle({ icon: Icon, className }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-[#1F1D1B]", className)}>
      <Icon strokeWidth={1.6} className="h-5 w-5 text-[#CE6A4A]" />
    </span>
  );
}

function Stat({ icon, label, value, first }) {
  return (
    <div className={cn("flex items-center gap-4 py-1 sm:px-6", !first && "sm:border-l sm:border-white/[0.08]", first && "sm:pl-0")}>
      <IconCircle icon={icon} className="h-12 w-12" />
      <div>
        <div className="text-sm text-[#8F8781]">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function TierJourney({ current, next, pointsToNext, progressPercent }) {
  const idx = TIER_ORDER.indexOf(current);
  const span = (idx / (TIER_ORDER.length - 1)) * 100;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-center">
      <div>
        <h2 className={sectionTitle}>Your journey</h2>
        <p className={sub}>Your history will grow with each table you take.</p>
        <div className="relative mt-7">
          <div className="absolute top-3 left-[12.5%] right-[12.5%] h-0.5 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#6B3A2E] to-[#CE6A4A]"
              style={{ width: `${span}%` }}
            />
          </div>
          <div className="relative grid grid-cols-4">
            {TIER_ORDER.map((t, i) => {
              const isCurrent = i === idx;
              return (
                <div key={t} className="flex flex-col items-center">
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full border-2 bg-[#1A1917]",
                      isCurrent
                        ? "border-[#CE6A4A] bg-[#CE6A4A] ring-4 ring-[#CE6A4A]/25"
                        : i < idx
                          ? "border-[#CE6A4A]"
                          : "border-[#4A4743]",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-3 text-[11px] font-bold tracking-[0.16em] uppercase text-center",
                      isCurrent ? "text-[#CE6A4A]" : "text-[#8F8781]",
                    )}
                  >
                    {t}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-5 rounded-xl bg-[#2A1B16] border border-[#CE6A4A]/15 p-5">
        <IconCircle icon={Crown} className="h-16 w-16 bg-[#3D2118]" />
        <div className="border-l border-white/[0.1] pl-5">
          {next ? (
            <>
              <div className="font-bold text-white">{pointsToNext.toLocaleString("en-IN")} more points.</div>
              <p className="mt-1 text-sm text-[#B8B2AA]">
                Until you reach {next}. {progressPercent}% of the way there.
              </p>
            </>
          ) : (
            <>
              <div className="font-bold text-white">You&apos;re at the highest tier.</div>
              <p className="mt-1 text-sm text-[#B8B2AA]">Enjoy exclusive access, curated experiences and more.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ item }) {
  return (
    <div className="flex gap-4 py-4 border-t border-white/[0.08] first:border-t-0" data-testid={`history-${item.id}`}>
      {item.venue_image && (
        <img src={item.venue_image} alt={item.venue_name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-[#8F8781]">
          {new Date(item.timestamp).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </div>
        <div className="text-lg font-bold">{item.venue_name}</div>
        <div className="text-sm text-[#8F8781]">
          {item.venue_type} · {item.venue_neighborhood}
        </div>
        {item.item_ordered && (
          <div className="mt-1 text-sm text-[#B8B2AA]">
            &ldquo;{item.item_ordered}&rdquo;
            {item.would_return === true && <span className="ml-2 text-xs font-bold text-[#CE6A4A]">Would return</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableName({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setValue(name);
    setEditing(true);
  };
  const save = async (e) => {
    e.preventDefault();
    const next = value.trim();
    if (!next || next === name) return setEditing(false);
    setBusy(true);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-3xl font-extrabold tracking-tight truncate" data-testid="profile-name">{name}</div>
        <button
          type="button"
          onClick={start}
          aria-label="Edit name"
          data-testid="profile-edit-name"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-[#CE6A4A] transition-colors hover:border-[#CE6A4A]"
        >
          <Pencil strokeWidth={1.8} className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="flex items-center gap-2" data-testid="profile-name-form">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={80}
        aria-label="Your name"
        data-testid="profile-name-input"
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="min-w-0 flex-1 rounded-xl border border-[#CE6A4A]/40 bg-[#1F1D1B] px-4 py-2 text-2xl font-extrabold tracking-tight text-white outline-none focus:border-[#CE6A4A]"
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        aria-label="Save name"
        data-testid="profile-save-name"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F07F5E] text-[#2A0F07] transition-colors hover:bg-[#F59273] disabled:opacity-50"
      >
        <Check strokeWidth={2.2} className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-[#B8B2AA] transition-colors hover:text-white"
      >
        <X strokeWidth={2} className="h-5 w-5" />
      </button>
    </form>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [correspondence, setCorrespondence] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [coverImage, setCoverImage] = useState(null);

  useEffect(() => {
    async function load() {
      const [w, h, c, b] = await Promise.all([
        api.get("/wallet"),
        api.get("/members/me/history"),
        api.get("/members/me/concierge"),
        api.get("/members/me/bookings"),
      ]);
      setWallet(w.data);
      setHistory(h.data);
      setCorrespondence(c.data);
      setBookings(b.data);
    }
    load().catch(() => {}); // 401s are handled globally (redirect to login)
    api.get("/venues").then(({ data }) => setCoverImage(data?.[0]?.image_url || null)).catch(() => {});
  }, []);

  const saveName = async (name) => {
    try {
      await api.patch("/members/me", { name });
      await refresh();
      toast.success("Name updated.");
      return true;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not update your name.");
      return false;
    }
  };

  const cancelBooking = async (id) => {
    try {
      await api.post(`/bookings/${id}/cancel`);
      toast.success("Reservation cancelled.");
      const { data } = await api.get("/members/me/bookings");
      setBookings(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not cancel just now.");
    }
  };

  if (!wallet || !user) {
    return <div className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8F8781] text-center">Loading…</div>;
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const streak = new Set(
    history.filter((h) => new Date(h.timestamp).getTime() >= weekAgo).map((h) => new Date(h.timestamp).toDateString()),
  ).size;

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-6 pt-2 pb-10 space-y-4" data-testid="profile-page">
      <div>
        <div className="text-xs font-semibold tracking-[0.2em] uppercase text-[#8F8781]">Member profile</div>
        <h1 className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-[-0.03em]">{user.name}</h1>
      </div>

      {/* Identity + stats */}
      <section className={card}>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full bg-[#4A2A20]">
            <User strokeWidth={1.4} className="h-12 w-12 text-[#CE6A4A]" />
          </span>
          <div className="flex-1 min-w-0">
            <EditableName name={user.name} onSave={saveName} />
            <div className="mt-1 font-semibold text-[#B8B2AA]">{user.email}</div>
          </div>
          <span
            data-testid="profile-tier-badge"
            className="inline-flex items-center gap-2 rounded-full border border-[#CE6A4A]/60 bg-[#2A1B16] px-5 py-2.5 text-xs font-extrabold tracking-[0.16em] uppercase text-[#CE6A4A]"
          >
            <Crown strokeWidth={2} className="h-4 w-4" />
            {user.tier}
          </span>
        </div>
        <div className="mt-6 pt-5 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0">
          <Stat
            first
            icon={CalendarDays}
            label="Member since"
            value={new Date(user.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          />
          <Stat icon={BarChart3} label="Visits" value={wallet.visits} />
          <Stat icon={Star} label="Lifetime" value={wallet.lifetime_points.toLocaleString()} />
        </div>
      </section>

      {/* Journey */}
      <section className={card}>
        <TierJourney
          current={wallet.tier}
          next={wallet.next_tier}
          pointsToNext={wallet.points_to_next}
          progressPercent={wallet.progress_percent}
        />
      </section>

      {streak > 0 && (
        <section className={cn(card, "flex items-center justify-between gap-6")}>
          <div>
            <div className="text-xs font-extrabold tracking-[0.16em] uppercase text-[#CE6A4A]">A streak</div>
            <div className="mt-1 text-2xl font-extrabold">
              {streak} {streak === 1 ? "night" : "nights"} this week.
            </div>
            <div className={sub}>
              {streak >= 4 ? "The room knows you well." : streak >= 2 ? "The night has a rhythm now." : "A quiet beginning."}
            </div>
          </div>
          <div className="text-6xl font-extrabold text-[#CE6A4A] tabular-nums">{streak}</div>
        </section>
      )}

      {/* Story + discover */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className={card}>
          <h2 className={sectionTitle}>Your TABLE story</h2>
          <p className={sub}>Rooms you have kept company with.</p>
          {history.length === 0 ? (
            <div className="mt-6 flex flex-col items-center text-center py-4">
              <IconCircle icon={CalendarDays} className="h-20 w-20 bg-[#3D2118]" />
              <div className="mt-4 font-bold">Your restaurant visits will appear here.</div>
              <p className="mt-1 max-w-[260px] text-sm text-[#8F8781]">
                Start dining, exploring and creating your story with TABLE.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {history.map((h) => (
                <TimelineEntry key={h.id} item={h} />
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-[#1A1917] border border-white/[0.04] p-6 sm:p-7 min-h-[270px] flex flex-col">
          {coverImage && (
            <>
              <img src={coverImage} alt="" className="absolute right-0 top-0 h-3/5 w-3/5 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1A1917] via-[#1A1917]/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1917] via-transparent to-transparent" />
            </>
          )}
          <div className="relative">
            <h2 className={sectionTitle}>Discover your next table</h2>
            <p className="mt-1 max-w-[240px] text-sm text-[#B8B2AA]">
              Explore curated dining experiences and find your next favourite room.
            </p>
          </div>
          <Link
            to="/discover"
            className="relative mt-auto flex items-center justify-between rounded-full bg-[#CE6A4A] px-5 py-4 text-[15px] font-extrabold text-[#0B0A0A] hover:bg-[#E8A06E] transition-colors"
          >
            <span className="flex items-center gap-3">
              <Compass strokeWidth={1.8} className="h-5 w-5" />
              Explore restaurants
            </span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>

      {(user.role === "staff" || user.role === "admin") && (
        <section className={card}>
          <h2 className={sectionTitle}>Staff access</h2>
          <Link
            to="/staff"
            className="mt-4 inline-block rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:border-[#CE6A4A]"
            data-testid="profile-staff-link"
          >
            Open Staff Dashboard
          </Link>
        </section>
      )}

      {bookings.length > 0 && (
        <section className={card} data-testid="reservations-section">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={sectionTitle}>Your reservations</h2>
            <Link to="/bookings" className="text-sm font-bold text-[#EE9B79] hover:text-[#CE6A4A]">Manage all →</Link>
          </div>
          <p className={sub}>Tables held in your name.</p>
          <div className="mt-5 space-y-3">
            {bookings.map((b) => {
              const cancellable = ["pending", "confirmed", "awaiting_payment"].includes(b.status);
              return (
                <div key={b.id} className="rounded-xl bg-[#232120] p-5" data-testid={`reservation-${b.id}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-lg font-bold">{b.venue_name}</div>
                      <div className="text-sm text-[#8F8781]">
                        {new Date(b.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {b.time}
                        {" · Party of "}
                        {b.party_size}
                      </div>
                    </div>
                    <div className={cn("text-xs font-bold tracking-widest uppercase", BOOKING_STATUS_COLOR[b.status])}>
                      {BOOKING_STATUS_LABEL[b.status]}
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                    <span className="text-xs text-[#8F8781]">Code</span>
                    <span
                      className="font-mono tracking-[0.28em] text-[#CE6A4A]"
                      data-testid={`reservation-code-${b.id}`}
                    >
                      {b.code}
                    </span>
                  </div>
                  {b.payment_status === "paid" && (
                    <div className="mt-2 text-xs text-[#8F8781]">
                      ₹{b.deposit_amount} deposit paid · adjusted against your bill
                    </div>
                  )}
                  {b.payment_status === "refunded" && (
                    <div className="mt-2 text-xs text-[#7DBE8A]">₹{b.deposit_amount} deposit refunded</div>
                  )}
                  {b.note && <p className="mt-3 text-sm italic text-[#B8B2AA]">&ldquo;{b.note}&rdquo;</p>}
                  {b.staff_reply && (
                    <div className="mt-4 pt-4 border-t border-white/[0.08]">
                      <div className="mb-1 text-xs font-bold text-[#CE6A4A]">The room replied</div>
                      <p className="text-sm text-[#B8B2AA]">{b.staff_reply}</p>
                    </div>
                  )}
                  {cancellable && (
                    <button
                      type="button"
                      onClick={() => cancelBooking(b.id)}
                      data-testid={`reservation-cancel-${b.id}`}
                      className="mt-4 text-sm font-semibold text-[#8F8781] hover:text-[#E8A33D] transition-colors"
                    >
                      Release the table
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {correspondence.length > 0 && (
        <section className={card}>
          <h2 className={sectionTitle}>Your correspondence</h2>
          <p className={sub}>Notes sent to the rooms.</p>
          <div className="mt-5 space-y-3">
            {correspondence.map((c) => (
              <div key={c.id} className="rounded-xl bg-[#232120] p-5" data-testid={`correspondence-${c.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#8F8781]">{CONCIERGE_TYPE_LABEL[c.request_type] || "Note"}</div>
                    <div className="text-lg font-bold">{c.venue_name}</div>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-bold tracking-widest uppercase",
                      c.status === "pending" && "text-[#B8B2AA]",
                      c.status === "acknowledged" && "text-[#CE6A4A]",
                      c.status === "declined" && "text-[#E8A33D]",
                      c.status === "fulfilled" && "text-[#7DBE8A]",
                    )}
                  >
                    {CONCIERGE_STATUS_LABEL[c.status]}
                  </div>
                </div>
                <p className="mt-3 text-sm italic text-[#B8B2AA] leading-relaxed">&ldquo;{c.message}&rdquo;</p>
                {c.response && (
                  <div className="mt-4 pt-4 border-t border-white/[0.08]">
                    <div className="mb-1 text-xs font-bold text-[#CE6A4A]">The room replied</div>
                    <p className="text-sm text-[#B8B2AA] leading-relaxed">{c.response}</p>
                  </div>
                )}
                <div className="mt-3 text-xs text-[#8F8781]">
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
