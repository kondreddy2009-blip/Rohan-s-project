import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { TierBadge } from "@/components/TierBadge";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Guest", "Regular", "Devotee", "Inner Circle"];

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
                  active ? "bg-[#C2A36B]" : "bg-[#2A2A2A]",
                )}
              />
              <div
                className={cn(
                  "overline mt-2 whitespace-nowrap",
                  active ? "text-[#C2A36B]" : "text-[#5C5C5C]",
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
          <div className="relative h-px bg-[#2A2A2A]">
            <div
              className="absolute inset-y-0 left-0 bg-[#C2A36B]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 font-serif text-lg text-[#F4F4EE]/80 italic">
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
        <div className="text-sm text-[#8E8E8E] mt-1 font-light">
          {item.venue_type} · {item.venue_neighborhood}
        </div>
        {item.item_ordered && (
          <div className="mt-3 font-serif italic text-[#F4F4EE]/85">
            "{item.item_ordered}"{" "}
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

  useEffect(() => {
    async function load() {
      const [w, h] = await Promise.all([api.get("/wallet"), api.get("/members/me/history")]);
      setWallet(w.data);
      setHistory(h.data);
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
        <p className="text-[#8E8E8E] font-light">Rooms you have kept company with.</p>
        <div className="mt-6">
          {history.length === 0 ? (
            <div className="text-[#8E8E8E] font-light py-8">
              Your history will grow with each Ritual you begin.
            </div>
          ) : (
            history.map((h, i) => <TimelineEntry key={h.id} item={h} index={i} />)
          )}
        </div>
      </div>
    </div>
  );
}
