// Single data layer for the partner network. Every list (hero, tabs, grid,
// network, events, filters, counts) reads from usePartners() so a change made
// through the admin form shows up everywhere after one invalidation.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BACKEND_URL } from "@/lib/api";

export const PARTNERS_KEY = ["partners"];

export const AVAILABILITY_OPTIONS = [
  { value: "seat_now", label: "Seat now" },
  { value: "quiet", label: "Quiet" },
  { value: "waitlist", label: "Waitlist" },
  { value: "full", label: "Full" },
];

export const PRICE_BANDS = [
  { value: 1, label: "Under ₹800" },
  { value: 2, label: "₹800–1,500" },
  { value: 3, label: "₹1,500–3,000" },
  { value: 4, label: "₹3,000+" },
];

const isOpen = (p) => p.availability === "seat_now" || p.availability === "quiet";

export const PARTNER_FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "walk-in", label: "Walk-in now", match: (p) => p.walk_in && isOpen(p) },
  { key: "under-800", label: "Under ₹800", match: (p) => p.price_band === 1 },
  { key: "2x", label: "2× points", match: (p) => p.double_points_tonight },
];

/** Dot tone plus short ("Seat now") and long ("Quiet · seat now") labels. */
export function partnerStatus(p) {
  switch (p.availability) {
    case "quiet":
      return { tone: "open", short: "Seat now", long: "Quiet · seat now" };
    case "waitlist": {
      const mins = p.waitlist_minutes || 15;
      return { tone: "wait", short: `${mins} min`, long: `Waitlist · ${mins} min` };
    }
    case "full":
      return { tone: "full", short: "Full", long: "Full tonight" };
    default:
      return { tone: "open", short: "Seat now", long: "Seat now" };
  }
}

// Waitlists first (shortest wait leading), then full rooms, then open ones.
const URGENCY = { waitlist: 0, full: 1, seat_now: 2, quiet: 3 };
export function byUrgency(a, b) {
  const d = (URGENCY[a.availability] ?? 9) - (URGENCY[b.availability] ?? 9);
  if (d !== 0) return d;
  return (a.waitlist_minutes || 0) - (b.waitlist_minutes || 0);
}

export function partnerImage(url) {
  if (url && url.startsWith("/api/")) return `${BACKEND_URL}${url}`;
  return url || "";
}

export function slugify(name) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "partner"
  );
}

export function isUpcoming(event, now = new Date()) {
  return new Date(`${event.date}T${event.time}`) >= now;
}

/** "Fri 9 Oct · 8 PM" */
export function formatEventWhen(event) {
  const d = new Date(`${event.date}T${event.time}`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const [h, m] = event.time.split(":").map(Number);
  const hour12 = h % 12 || 12;
  const time = `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
  return `${day.replace(",", "")} · ${time}`;
}

// --- API ---------------------------------------------------------------
export const partnersService = {
  list: () => api.get("/partners").then((r) => r.data),
  create: (payload) => api.post("/partners", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/partners/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/partners/${id}`).then((r) => r.data),
  uploadPhoto: (dataUrl) => api.post("/partners/photo", { data_url: dataUrl }).then((r) => r.data.url),
  toggleRsvp: (eventId) => api.post(`/events/${eventId}/rsvp`).then((r) => r.data),
};

// --- Hooks -------------------------------------------------------------
export function usePartners() {
  return useQuery({ queryKey: PARTNERS_KEY, queryFn: partnersService.list });
}

export function usePartnerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PARTNERS_KEY });
  return {
    create: useMutation({ mutationFn: partnersService.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }) => partnersService.update(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: partnersService.remove, onSuccess: invalidate }),
  };
}

export function useToggleRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: partnersService.toggleRsvp,
    onSuccess: () => qc.invalidateQueries({ queryKey: PARTNERS_KEY }),
  });
}
