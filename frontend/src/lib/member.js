// Signed-in member's wallet + visit history, shared by the nav streak,
// tier card and per-restaurant points panel.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DAY_MS = 24 * 60 * 60 * 1000;

function useIsMember() {
  const { user } = useAuth();
  return !!user && (user.role === "member" || user.role === "admin");
}

export function useWallet() {
  const enabled = useIsMember();
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get("/wallet").then((r) => r.data),
    enabled,
    staleTime: 0,
  });
}

export function useHistory() {
  const enabled = useIsMember();
  return useQuery({
    queryKey: ["history"],
    queryFn: () => api.get("/members/me/history").then((r) => r.data),
    enabled,
    staleTime: 0,
  });
}

/** Consecutive days with a check-in, ending today or yesterday. */
export function useStreak() {
  const { data: history } = useHistory();
  return useMemo(() => {
    if (!history?.length) return 0;
    const days = new Set(history.map((h) => new Date(h.timestamp).toDateString()));
    const cursor = new Date();
    if (!days.has(cursor.toDateString())) cursor.setTime(cursor.getTime() - DAY_MS);
    let streak = 0;
    while (days.has(cursor.toDateString())) {
      streak += 1;
      cursor.setTime(cursor.getTime() - DAY_MS);
    }
    return streak;
  }, [history]);
}

/** Distinct partners the member has earned points at. */
export function partnersVisited(wallet) {
  if (!wallet) return 0;
  return new Set(wallet.ledger.filter((l) => l.type === "earn").map((l) => l.venue_id)).size;
}

export function pointsAtVenue(wallet, venueId) {
  const earned = (wallet?.ledger || []).filter((l) => l.venue_id === venueId && l.type === "earn");
  return {
    points: earned.reduce((sum, l) => sum + l.points_delta, 0),
    visits: earned.length,
  };
}
