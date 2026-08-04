import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { StatusIndicator } from "@/components/StatusIndicator";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Quiet", "Filling In", "At Capacity"];

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
              ? "border-[#C2A36B] bg-[#161616]"
              : "border-[#2A2A2A] hover:border-[#8E8E8E]",
          )}
        >
          <StatusIndicator status={s} showLabel={false} />
          <div
            className={cn(
              "mt-2 font-serif text-lg",
              current === s ? "text-[#C2A36B]" : "text-[#F4F4EE]",
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
    <div className="p-6 border border-[#2A2A2A] bg-[#161616]">
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
    } catch (e2) {
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
          className="w-full bg-transparent border-b border-[#2A2A2A] py-2 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300"
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
          className="w-full bg-transparent border border-[#2A2A2A] p-3 focus:border-[#C2A36B] outline-none font-light transition-colors duration-300 resize-none"
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
            className="w-full bg-transparent border-b border-[#2A2A2A] py-2 focus:border-[#C2A36B] outline-none font-light text-[#F4F4EE] transition-colors duration-300"
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
            className="w-full bg-transparent border-b border-[#2A2A2A] py-2 focus:border-[#C2A36B] outline-none font-light text-[#F4F4EE] transition-colors duration-300"
          />
        </div>
      </div>
      <div>
        <label className="overline block mb-2">Tier gate (optional)</label>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          data-testid="event-tier-select"
          className="w-full bg-[#161616] border border-[#2A2A2A] py-2 px-3 focus:border-[#C2A36B] outline-none font-light text-[#F4F4EE] transition-colors duration-300"
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

export default function StaffDashboard() {
  const [venues, setVenues] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview"); // overview | events | redemptions

  const loadVenues = async () => {
    const { data } = await api.get("/staff/venues");
    setVenues(data);
    if (data.length > 0 && !selectedId) {
      setSelectedId(data[0].id);
    }
  };

  const loadAnalytics = async (vid) => {
    if (!vid) return;
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        api.get(`/staff/venues/${vid}/analytics`),
        api.get(`/staff/venues/${vid}/redemptions`),
      ]);
      setAnalytics(a.data);
      setRedemptions(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAnalytics(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedId),
    [venues, selectedId],
  );

  const updateStatus = async (newStatus) => {
    if (!selectedId) return;
    try {
      await api.patch(`/staff/venues/${selectedId}/status`, { status: newStatus });
      toast.success(`Room set to ${newStatus}.`);
      await loadVenues();
      await loadAnalytics(selectedId);
    } catch {
      toast.error("Could not update status.");
    }
  };

  if (!analytics || !selectedVenue) {
    return <div className="mx-auto max-w-4xl px-5 py-16 overline text-center">Loading dashboard…</div>;
  }

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
              className="bg-[#161616] border border-[#2A2A2A] py-2 px-3 focus:border-[#C2A36B] outline-none font-light text-[#F4F4EE]"
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

      {/* Status control */}
      <div className="mt-10 animate-fade-up delay-100">
        <div className="overline mb-4">Room energy</div>
        <StatusControl current={selectedVenue.status} onChange={updateStatus} />
      </div>

      {/* Tabs */}
      <div className="mt-14 flex items-center gap-1 border-b border-[#2A2A2A]" role="tablist">
        {[
          { k: "overview", l: "Overview" },
          { k: "redemptions", l: "Redemptions" },
          { k: "events", l: "Events" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            role="tab"
            data-testid={`tab-${t.k}`}
            className={cn(
              "px-5 py-3 overline transition-colors duration-300 border-b -mb-px",
              tab === t.k
                ? "text-[#C2A36B] border-[#C2A36B]"
                : "text-[#8E8E8E] border-transparent hover:text-[#F4F4EE]",
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-10 space-y-10 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Check-ins · week"
              value={analytics.checkins_week}
              hint={`${analytics.checkins_total} total`}
            />
            <StatCard label="Points issued" value={analytics.points_issued.toLocaleString()} />
            <StatCard label="Points redeemed" value={analytics.points_redeemed.toLocaleString()} />
            <StatCard
              label="Room energy"
              value={selectedVenue.status}
              hint={`${selectedVenue.capacity_percent ?? 0}% capacity`}
            />
          </div>

          <div>
            <div className="overline mb-6">What regulars return for</div>
            {analytics.top_offerings.length === 0 ? (
              <div className="text-[#8E8E8E] font-light">
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

      {tab === "redemptions" && (
        <div className="mt-10 animate-fade-up">
          {redemptions.length === 0 ? (
            <div className="text-[#8E8E8E] font-light py-8">
              No redemptions held here yet.
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 p-5 border border-[#2A2A2A]"
                  data-testid={`staff-redemption-${r.id}`}
                >
                  <div className="min-w-0">
                    <div className="font-serif-display text-xl">{r.perk_name}</div>
                    <div className="overline mt-1">
                      {r.member_name} · {r.member_tier}
                    </div>
                    <div className="text-xs text-[#5C5C5C] mt-1">
                      {new Date(r.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="font-mono tracking-widest text-[#C2A36B] text-sm">
                    {r.code}
                  </div>
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
            <EventForm venueId={selectedId} onCreated={() => loadAnalytics(selectedId)} />
          </div>
          <div>
            <div className="overline mb-6">On the calendar</div>
            <div className="space-y-3">
              {(analytics.venue?.events || []).length === 0 && (
                <div className="text-[#8E8E8E] font-light">No events yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
