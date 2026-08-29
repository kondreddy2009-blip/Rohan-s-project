import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { TierBadge } from "@/components/TierBadge";
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

function TierJourney({ current, next, pointsToNext, progressPercent }) {
  return (
    <div>
      <div className="overline mb-4">Your journey</div>
      <div className="flex items-center gap-2">
        {TIER_ORDER.map((t, i) => {
          const currentIdx = TIER_ORDER.indexOf(current);
          const active = i <= currentIdx;
          return (
            <div key={t} className="flex-1">
              <div
                className={cn(
                  "h-px w-full",
                  active ? "bg-[#C2A36B]" : "bg-[#253453]",
                )}
              />
              <div
                className={cn(
                  "overline mt-2 whitespace-nowrap",
                  active ? "text-[#C2A36B]" : "text-[#5F6A83]",
                )}
              >
                {t}
              </div>
            </div>
          );
        })}
      </div>
      {next && (
        <div className="mt-8">
          <div className="overline mb-2">Toward {next}</div>
          <div className="relative h-px bg-[#253453]">
            <div
              className="absolute inset-y-0 left-0 bg-[#C2A36B]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 font-serif text-lg text-[#E8ECF5]/80 italic">
            {pointsToNext} more points until {next}.
          </div>
        </div>
      )}
      {!next && (
        <div className="mt-8 overline-accent">You are at the highest tier.</div>
      )}
    </div>
  );
}

function TimelineEntry({ item, index }) {
  return (
    <div
      className="flex gap-5 py-6 border-b border-white/[0.05] animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
      data-testid={`history-${item.id}`}
    >
      <div className="w-16 h-20 flex-shrink-0 overflow-hidden hidden sm:block">
        {item.venue_image ? (
          <img
            src={item.venue_image}
            alt={item.venue_name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="overline">
          {new Date(item.timestamp).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <div className="font-serif-display text-2xl mt-1">{item.venue_name}</div>
        <div className="text-sm text-[#8996B0] mt-1 font-light">
          {item.venue_type} · {item.venue_neighborhood}
        </div>
        {item.item_ordered && (
          <div className="mt-3 font-serif italic text-[#E8ECF5]/85">
            {`"${item.item_ordered}"`}{" "}
            {item.would_return === true && (
              <span className="overline-accent ml-2">Would return</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [correspondence, setCorrespondence] = useState([]);

  useEffect(() => {
    async function load() {
      const [w, h, c] = await Promise.all([
        api.get("/wallet"),
        api.get("/members/me/history"),
        api.get("/members/me/concierge"),
      ]);
      setWallet(w.data);
      setHistory(h.data);
      setCorrespondence(c.data);
    }
    load();
  }, []);

  if (!wallet || !user) {
    return <div className="mx-auto max-w-3xl px-5 py-16 overline text-center">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14" data-testid="profile-page">
      <div className="flex items-start justify-between gap-4 animate-fade-up">
        <div>
          <div className="overline">Member profile</div>
          <h1 className="font-serif-display text-4xl sm:text-5xl mt-2">{user.name}</h1>
          <div className="mt-2 overline">{user.email}</div>
        </div>
        <TierBadge tier={user.tier} testId="profile-tier-badge" />
      </div>

      <div className="mt-10 grid grid-cols-3 gap-6 sm:gap-10 animate-fade-up delay-100">
        <div>
          <div className="overline mb-2">Member since</div>
          <div className="font-serif text-xl">
            {new Date(user.member_since).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        <div>
          <div className="overline mb-2">Visits</div>
          <div className="font-serif text-xl">{wallet.visits}</div>
        </div>
        <div>
          <div className="overline mb-2">Lifetime</div>
          <div className="font-serif text-xl">{wallet.lifetime_points.toLocaleString()}</div>
        </div>
      </div>

      {(() => {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const dates = new Set(
          history
            .filter((h) => new Date(h.timestamp).getTime() >= sevenDaysAgo)
            .map((h) => new Date(h.timestamp).toDateString()),
        );
        const streak = dates.size;
        if (streak === 0) return null;
        return (
          <div className="mt-10 border border-[#C2A36B]/30 bg-[#121D33] p-5 sm:p-6 flex items-center justify-between gap-6 animate-fade-up delay-200">
            <div>
              <div className="overline-accent mb-1">A streak</div>
              <div className="font-serif-display text-2xl">
                {streak} {streak === 1 ? "night" : "nights"} this week.
              </div>
              <div className="text-sm text-[#8996B0] font-light mt-1">
                {streak >= 4
                  ? "The room knows you well."
                  : streak >= 2
                    ? "The night has a rhythm now."
                    : "A quiet beginning."}
              </div>
            </div>
            <div className="font-serif-display text-6xl text-[#C2A36B] tabular-nums">{streak}</div>
          </div>
        );
      })()}

      <div className="mt-14 animate-fade-up delay-200">
        <TierJourney
          current={wallet.tier}
          next={wallet.next_tier}
          pointsToNext={wallet.points_to_next}
          progressPercent={wallet.progress_percent}
        />
      </div>

      {(user.role === "staff" || user.role === "admin") && (
        <div className="mt-14 animate-fade-up">
          <div className="overline mb-3">Staff access</div>
          <Link to="/staff" className="btn-ghost inline-block" data-testid="profile-staff-link">
            Open Staff Dashboard
          </Link>
        </div>
      )}

      <div className="mt-14 animate-fade-up">
        <div className="overline mb-2">A curated timeline</div>
        <p className="text-[#8996B0] font-light">Rooms you have kept company with.</p>
        <div className="mt-6">
          {history.length === 0 ? (
            <div className="text-[#8996B0] font-light py-8">
              Your history will grow with each table you take.
            </div>
          ) : (
            history.map((h, i) => <TimelineEntry key={h.id} item={h} index={i} />)
          )}
        </div>
      </div>

      {correspondence.length > 0 && (
        <div className="mt-14 animate-fade-up">
          <div className="overline mb-2">Your correspondence</div>
          <p className="text-[#8996B0] font-light">Notes sent to the rooms.</p>
          <div className="mt-6 space-y-4">
            {correspondence.map((c) => (
              <div
                key={c.id}
                className="p-5 border border-[#253453] bg-[#121D33]"
                data-testid={`correspondence-${c.id}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="overline">{CONCIERGE_TYPE_LABEL[c.request_type] || "Note"}</div>
                    <div className="font-serif-display text-xl mt-1">{c.venue_name}</div>
                  </div>
                  <div
                    className={cn(
                      "text-xs tracking-widest uppercase",
                      c.status === "pending" && "text-[#8996B0]",
                      c.status === "acknowledged" && "text-[#C2A36B]",
                      c.status === "declined" && "text-[#C08B70]",
                      c.status === "fulfilled" && "text-[#7A9B7A]",
                    )}
                  >
                    {CONCIERGE_STATUS_LABEL[c.status]}
                  </div>
                </div>
                <p className="mt-3 font-serif italic text-[#E8ECF5]/85 leading-relaxed">
                  {`"${c.message}"`}
                </p>
                {c.response && (
                  <div className="mt-4 pt-4 border-t border-white/[0.05]">
                    <div className="overline-accent mb-1">The room replied</div>
                    <p className="text-sm text-[#E8ECF5]/85 font-light leading-relaxed">
                      {c.response}
                    </p>
                  </div>
                )}
                <div className="overline mt-4">
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
        </div>
      )}
    </div>
  );
}
