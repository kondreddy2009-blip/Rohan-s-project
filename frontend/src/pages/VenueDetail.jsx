import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, MessageSquare, ChefHat, CalendarCheck, Users, Gift, Sparkles, Leaf, ChevronRight, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { queueLabel } from "@/components/StatusIndicator";
import { fillingFastStatus } from "@/components/FillingFastCard";
import { ConciergeModal } from "@/components/ConciergeModal";
import { BookingModal } from "@/components/BookingModal";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReviewsSection, RatingBadge } from "@/components/Reviews";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/lib/usePageTitle";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Guest", "Regular", "Insider", "Inner Circle"];

export default function VenueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [loyalty, setLoyalty] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [rating, setRating] = useState(null);
  usePageTitle(venue?.name);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get(`/venues/${id}`);
        if (!cancelled) setVenue(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user || (user.role !== "member" && user.role !== "admin")) return;
    let cancelled = false;
    async function loadLoyalty() {
      try {
        const { data } = await api.get(`/venues/${id}/loyalty`);
        if (!cancelled) setLoyalty(data);
      } catch {
        // no-op — loyalty card just won't render
      }
    }
    loadLoyalty();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  // Browsing is public; anything that acts on the member's account needs a sign-in first.
  const requireLogin = (action) => () => {
    if (!user) {
      toast.message("Sign in to continue.");
      navigate("/login", { state: { from: { pathname: `/venues/${id}` } } });
      return;
    }
    action();
  };

  async function handleRedeem(reward) {
    if (!loyalty || loyalty.balance < reward.cost || redeemingId) return;
    setRedeemingId(reward.id);
    try {
      const { data } = await api.post(`/venues/${id}/loyalty/redeem`, { reward_id: reward.id });
      toast.success(`${reward.name} redeemed. Show this at the table: ${data.redemption.code}`);
      setLoyalty((prev) => (prev ? { ...prev, balance: data.balance } : prev));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not redeem right now.");
    } finally {
      setRedeemingId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-3 sm:px-6 space-y-4" aria-busy="true" data-testid="venue-skeleton">
        <Skeleton className="h-[420px] rounded-2xl bg-white/[0.06]" />
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
          <Skeleton className="h-40 rounded-2xl bg-white/[0.06]" />
          <Skeleton className="h-40 rounded-2xl bg-white/[0.06]" />
        </div>
        <Skeleton className="h-56 rounded-2xl bg-white/[0.06]" />
      </div>
    );
  }
  if (!venue) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="text-sm text-[#8E8982]">This room could not be found.</div>
        <Link to="/discover" className="mt-6 inline-block rounded-full border border-white/20 px-5 py-2 text-sm font-semibold">Return</Link>
      </div>
    );
  }

  const userTierIdx = TIER_ORDER.indexOf(user?.tier || "Guest");
  const { dot: statusDot } = fillingFastStatus(venue);
  const statusText =
    venue.availability === "fully_booked"
      ? "Fully booked"
      : venue.availability === "closed"
        ? "Closed for the night"
        : venue.status === "At Capacity"
          ? "At capacity"
          : venue.status === "Filling In"
            ? "Filling in"
            : "Quiet · seat now";
  const card = "rounded-2xl bg-[#1F1D1B] p-6";
  const heading = "text-2xl font-extrabold tracking-tight text-white";
  const facts = [
    { icon: Clock, label: "Hours", value: venue.hours },
    { icon: MapPin, label: "Neighborhood", value: venue.neighborhood },
    {
      icon: Leaf,
      label: "Room energy",
      value: (
        <span className="inline-flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", statusDot)} />
          {venue.status}
        </span>
      ),
    },
    venue.queue_length != null && {
      icon: Users,
      label: "Waitlist",
      testId: "venue-queue",
      value: (
        <>
          {queueLabel(venue.queue_length)}
          {venue.wait_minutes > 0 && <span className="text-[#8E8982]"> · ~{venue.wait_minutes} min</span>}
        </>
      ),
    },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1100px] px-3 sm:px-6 pb-8 space-y-4" data-testid="venue-detail-page">
      {/* Hero */}
      <section className="relative h-[420px] overflow-hidden rounded-2xl">
        <img src={venue.image_url} alt={venue.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25" />
        <div
          className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold"
          data-testid="venue-status"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          {statusText}
        </div>
        <div className="absolute inset-x-6 bottom-6">
          <div className="text-[13px] font-semibold text-white/75">
            {venue.neighborhood} · {venue.cuisine}
            {venue.price_level ? ` · ${"₹".repeat(venue.price_level)}` : ""}
            {(rating ?? { avg: venue.rating_avg, count: venue.rating_count })?.count > 0 && (
              <>
                {" · "}
                <RatingBadge
                  avg={(rating ?? { avg: venue.rating_avg }).avg}
                  count={(rating ?? { count: venue.rating_count }).count}
                  className="align-middle text-white"
                />
              </>
            )}
          </div>
          <h1 className="mt-1 text-5xl sm:text-6xl font-extrabold tracking-tight leading-none" data-testid="venue-name">
            {venue.name}
          </h1>
          {venue.vibes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid="venue-vibes">
              {venue.vibes.map((v) => (
                <span key={v} className="rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-bold">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About + facts */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4">
        <section className={card}>
          <h2 className={heading}>About the room</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#B8B2AA]">{venue.description}</p>
        </section>
        <section className={cn(card, "py-3")}>
          {facts.map((f, i) => (
            <div
              key={f.label}
              data-testid={f.testId}
              className={cn("flex items-center gap-4 py-3.5", i > 0 && "border-t border-white/[0.08]")}
            >
              <f.icon strokeWidth={1.5} className="h-5 w-5 text-[#E27D60] shrink-0" />
              <div>
                <div className="text-xs text-[#8E8982]">{f.label}</div>
                <div className="text-[15px] font-semibold">{f.value}</div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <PhotoGallery photos={venue.photos} heading={heading} card={card} />

      {/* Signature offerings */}
      {(venue.signature_offerings || []).length > 0 && (
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className={heading}>What regulars order</h2>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E27D60]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-3">
            {venue.signature_offerings.map((o, i) => (
              <div
                key={o.name}
                className={cn("flex items-center gap-5 py-4", i > 0 && "border-t border-white/[0.08]")}
                data-testid={`offering-${i}`}
              >
                <span className="w-6 text-sm font-bold text-[#E27D60] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[17px] font-semibold">{o.name}</span>
                <span className="text-sm text-[#8E8982]">{o.order_count} returned</span>
                <ChevronRight className="h-4 w-4 text-[#8E8982]" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loyalty program — points earned & spent only at this restaurant */}
      {loyalty && (loyalty.balance > 0 || loyalty.config.rewards.length > 0) && (
        <section className={card} data-testid="venue-loyalty">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className={heading}>Your loyalty at {venue.name}</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#E27D60]" data-testid="venue-loyalty-balance">
                {loyalty.balance}
              </span>
              <span className="text-xs text-[#8E8982]">points here</span>
            </div>
          </div>
          {loyalty.config.rewards.length > 0 ? (
            <div className="mt-4 space-y-3">
              {loyalty.config.rewards.map((r) => {
                const affordable = loyalty.balance >= r.cost;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center justify-between gap-6 rounded-xl bg-[#262422] p-4",
                      !affordable && "opacity-50",
                    )}
                    data-testid={`venue-reward-${r.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <Gift strokeWidth={1.5} className="h-5 w-5 text-[#E27D60] mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold">{r.name}</div>
                        <p className="text-sm text-[#8E8982] mt-0.5">{r.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs font-bold text-[#E27D60]">{r.cost} pts</span>
                      <button
                        onClick={() => handleRedeem(r)}
                        disabled={!affordable || redeemingId === r.id}
                        data-testid={`redeem-venue-reward-${r.id}`}
                        className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold hover:border-[#E27D60] disabled:cursor-not-allowed"
                      >
                        {redeemingId === r.id ? "Redeeming…" : "Redeem"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#8E8982] flex items-center gap-2">
              <Sparkles strokeWidth={1.5} className="h-4 w-4" />
              Dine in or book a table to start earning points here.
            </p>
          )}
        </section>
      )}

      <ReviewsSection venueId={venue.id} user={user} card={card} heading={heading} onSummary={setRating} />

      {/* Kitchen + calendar | CTA */}
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          {venue.chef && (
            <section className={card}>
              <h2 className={heading}>In the kitchen</h2>
              <div className="mt-4 flex items-start gap-5">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#3A2219]">
                  <ChefHat strokeWidth={1.4} className="h-7 w-7 text-[#E27D60]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#E27D60]">Chef</div>
                  <div className="text-xl font-bold">{venue.chef}</div>
                  <p className="mt-1 text-sm text-[#8E8982] leading-relaxed">
                    Leads the {venue.cuisine || "kitchen"} at {venue.name}. Menu evolves with the
                    season; recognition comes from returning guests.
                  </p>
                </div>
              </div>
            </section>
          )}

          {venue.events?.length > 0 && (
            <section className={card}>
              <h2 className={heading}>On the calendar</h2>
              <div className="mt-4 space-y-5">
                {venue.events.map((e) => {
                  const gated = e.tier_required && TIER_ORDER.indexOf(e.tier_required) > userTierIdx;
                  return (
                    <div key={e.id} className="flex items-start gap-5" data-testid={`event-${e.id}`}>
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#3A2219]">
                        <Calendar strokeWidth={1.4} className="h-7 w-7 text-[#E27D60]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-[#8E8982] tabular-nums">
                          {e.date} · {e.time}
                        </div>
                        <div className="text-xl font-bold">{e.title}</div>
                        <p className="mt-1 text-sm text-[#8E8982] leading-relaxed">{e.description}</p>
                        {e.tier_required && (
                          <div className="mt-2 text-xs font-bold text-[#E27D60]">
                            {gated ? `${e.tier_required} Access` : `Open to ${e.tier_required}+`}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 mt-2 text-[#8E8982]" />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <section className={cn(card, "p-7")}>
          <div className="text-sm text-[#B8B2AA]">A moment awaits</div>
          <div className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight">
            Begin your Table at {venue.name}.
          </div>
          <button
            onClick={requireLogin(() => setBookingOpen(true))}
            data-testid="reserve-table-button"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#F4764F] py-4 text-[15px] font-extrabold text-[#1A0F0B] hover:bg-[#F78963] transition-colors"
          >
            <CalendarCheck strokeWidth={1.8} className="h-4 w-4" />
            Reserve a table
          </button>
          <button
            onClick={requireLogin(() => setConciergeOpen(true))}
            data-testid="speak-with-room-button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/70 py-4 text-sm font-bold hover:bg-white/5 transition-colors"
          >
            <MessageSquare strokeWidth={1.6} className="h-4 w-4" />
            Speak with the room
          </button>
          <Link
            to={`/checkin/${venue.id}`}
            data-testid="begin-ritual-button"
            className="mt-4 inline-block text-sm text-[#8E8982] hover:text-white transition-colors"
          >
            Or check in on arrival
          </Link>
        </section>
      </div>

      {conciergeOpen && <ConciergeModal venue={venue} onClose={() => setConciergeOpen(false)} />}
      {bookingOpen && <BookingModal venue={venue} onClose={() => setBookingOpen(false)} />}
    </div>
  );
}
