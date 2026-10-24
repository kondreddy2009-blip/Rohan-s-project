import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, Users, ArrowRight } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

function formatEventWhen(dateStr, time) {
  const d = new Date(`${dateStr}T${time || "00:00"}`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const hour = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: d.getMinutes() ? "2-digit" : undefined,
    hour12: true,
  });
  return `${day} ${date} · ${hour}`;
}

export function EventCard({ event, userTier, pointsAway }) {
  const required = event.tier_required;
  const userIdx = TIER_ORDER.indexOf(userTier || "Guest");
  const requiredIdx = required ? TIER_ORDER.indexOf(required) : -1;
  const locked = requiredIdx > userIdx;
  const navigate = useNavigate();
  const openVenue = () => navigate(`/venues/${event.venue_id}`);
  const { user } = useAuth();
  const [going, setGoing] = useState(!!event.my_rsvp);
  const [count, setCount] = useState(event.rsvp_count || 0);
  const [busy, setBusy] = useState(false);
  const seatsLeft = event.capacity ? Math.max(event.capacity - count, 0) : null;
  const full = seatsLeft === 0 && !going;

  const toggleRsvp = async (e) => {
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/events/${event.id}/rsvp`);
      setGoing(data.going);
      setCount(data.rsvp_count);
      toast.success(data.going ? `You're in for ${event.title}` : "RSVP cancelled");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not update RSVP");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openVenue}
      onKeyDown={(e) => e.key === "Enter" && openVenue()}
      className="rounded-2xl border border-white/10 bg-[#141312] overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-0.5"
      data-testid={`event-card-${event.id}`}>
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={event.venue_image_url}
          alt={event.venue_name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {required && (
          <span
            className={
              "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.14em] uppercase " +
              (locked ? "bg-black/55 text-[#B8B2AA]" : "bg-[#F07F5E] text-[#2A0F07]")
            }
          >
            {locked ? "Locked" : required}
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/90">
            <CalendarDays strokeWidth={1.5} className="h-4 w-4 text-[#F0A58C]" />
            {formatEventWhen(event.date, event.time)}
          </div>
          <h3 className="mt-1 font-['Cormorant_Garamond'] text-[30px] font-semibold text-white leading-tight">{event.title}</h3>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-2.5 text-[13px] text-[#B8AA98]">
          <Users strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[#F0A58C]" />
          <span>{seatsLeft !== null ? (full ? "Full · " : `${seatsLeft} of ${event.capacity} seats left · `) : ""}
          {required ? (locked ? `${required} only` : `${required} and above`) : "Open to all"}</span>
        </div>
        {locked ? (
          <span className="rounded-full bg-[#23201E] px-3.5 py-2 text-xs font-bold text-[#B8B2AA] whitespace-nowrap shrink-0">
            {pointsAway > 0 ? `${pointsAway.toLocaleString("en-IN")} pts away` : `Requires ${required}`}
          </span>
        ) : (
          <button
            type="button"
            onClick={toggleRsvp}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={busy || full}
            data-testid={`event-rsvp-${event.id}`}
            className={
              "inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 " +
              (going
                ? "bg-[#23201E] text-[#EE9B79] hover:bg-[#2C2927]"
                : "bg-[#F07F5E] text-[#2A0F07] hover:bg-[#F59273]")
            }
          >
            {full ? "Full" : going ? "✓ You're going" : <>Reserve a seat <ArrowRight className="h-4 w-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}
