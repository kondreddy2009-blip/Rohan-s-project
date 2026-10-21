import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EventCard } from "@/components/EventCard";
import { usePageTitle } from "@/lib/usePageTitle";
import { cn } from "@/lib/utils";

const serif = "font-['Cormorant_Garamond']";
const TIER_THRESHOLDS = { Guest: 0, Regular: 500, Insider: 1500, "Inner Circle": 3000 };

export default function Events() {
  usePageTitle("Events");
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    api.get("/events").then(({ data }) => setEvents(data)).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (user) api.get("/wallet").then(({ data }) => setWallet(data)).catch(() => {});
  }, [user]);

  const tier = wallet?.tier || user?.tier || "Guest";
  const lifetime = wallet?.lifetime_points ?? user?.lifetime_points ?? 0;
  const pointsAway = (required) => Math.max(0, (TIER_THRESHOLDS[required] ?? 0) - lifetime);

  return (
    <div className="relative px-5 sm:px-10 lg:px-16 pb-14" data-testid="events-page">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_85%_0%,rgba(232,162,127,0.16),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-[1280px]">
        <div className="pt-4">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8A27F]">
            Special experiences <span className="h-px w-12 bg-[#E8A27F]/60" />
          </div>
          <h1 className={cn(serif, "mt-4 flex items-center gap-4 text-5xl sm:text-6xl font-semibold text-[#F4F1EC]")}>
            Events <CalendarDays strokeWidth={1.3} className="h-10 w-10 text-[#E8A27F]" />
          </h1>
          <p className="mt-2 text-lg text-[#B8AA98]">What your tier opens, across every partner.</p>
        </div>

        <div className="mt-10">
          {events === null ? (
            <div className="py-16 text-center text-sm text-[#8E8982]">Loading…</div>
          ) : events.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#17110C]/90 px-6 py-14 text-center" data-testid="events-empty">
              <CalendarDays strokeWidth={1.2} className="h-14 w-14 text-[#E8A27F]" />
              <div className={cn(serif, "mt-5 text-4xl font-semibold text-[#F4F1EC]")}>No events right now</div>
              <p className="mt-2 text-[16px] text-[#B8AA98]">New dining experiences are announced here. Meanwhile, find a table.</p>
              <Link to="/discover" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#F07F5E] px-7 py-3.5 text-[15px] font-semibold text-[#2A0F07] transition-colors hover:bg-[#F59273]">
                Explore restaurants <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} userTier={tier} pointsAway={pointsAway(e.tier_required)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
