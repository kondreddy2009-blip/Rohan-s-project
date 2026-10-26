import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Stars({ value = 0, size = "h-4 w-4", className }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          strokeWidth={1.5}
          className={cn(size, n <= Math.round(value) ? "fill-[#E8A33D] text-[#E8A33D]" : "text-[#4A4642]")}
        />
      ))}
    </span>
  );
}

export function RatingBadge({ avg, count, className }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold", className)} data-testid="rating-badge">
      <Star strokeWidth={1.5} className="h-3.5 w-3.5 fill-[#E8A33D] text-[#E8A33D]" />
      {avg.toFixed(1)}
      <span className="font-medium opacity-60">({count})</span>
    </span>
  );
}

const timeAgo = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

function ReviewForm({ venueId, mine, onSaved, onCancel }) {
  const [rating, setRating] = useState(mine?.rating || 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(mine?.text || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Pick a star rating first.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/venues/${venueId}/reviews`, { rating, text });
      toast.success(mine ? "Review updated." : "Thanks for your review.");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl bg-[#1F1D1B] p-5" data-testid="review-form">
      <div className="text-sm font-semibold text-[#B8B2AA]">{mine ? "Edit your review" : "How was your visit?"}</div>
      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            data-testid={`review-star-${n}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star
              strokeWidth={1.5}
              className={cn("h-8 w-8 transition-colors", n <= (hover || rating) ? "fill-[#E8A33D] text-[#E8A33D]" : "text-[#5A5550]")}
            />
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={600}
        rows={3}
        placeholder="Tell others what you ordered and how it felt (optional)"
        data-testid="review-text"
        className="mt-3 w-full resize-none rounded-xl bg-[#1B1917] p-4 text-[15px] text-white outline-none ring-1 ring-white/[0.06] focus:ring-[#CE6A4A] placeholder:text-[#6F6A64]"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          data-testid="review-submit"
          className="rounded-full bg-[#CE6A4A] px-6 py-2.5 text-sm font-extrabold text-[#0B0A0A] hover:bg-[#E8A06E] disabled:opacity-50 transition-colors"
        >
          {busy ? "Saving…" : mine ? "Update review" : "Post review"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-[#8F8781] hover:text-white">
            Cancel
          </button>
        )}
        <span className="ml-auto text-xs text-[#6F6A64] tabular-nums">{text.length}/600</span>
      </div>
    </form>
  );
}

export function ReviewsSection({ venueId, user, card, heading, onSummary }) {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/venues/${venueId}/reviews`);
      setData(d);
      onSummary?.(d.summary);
    } catch {
      setData({ summary: { avg: null, count: 0, distribution: {} }, reviews: [], mine: null, can_review: false });
    }
  }, [venueId, onSummary]);

  useEffect(() => {
    load();
  }, [load, user]);

  if (!data) return null;
  const { summary, reviews, mine, can_review } = data;
  const showForm = can_review && (!mine || editing);

  const remove = async () => {
    try {
      await api.delete(`/venues/${venueId}/reviews/mine`);
      toast.success("Review deleted.");
      setEditing(false);
      load();
    } catch {
      toast.error("Could not delete your review.");
    }
  };

  return (
    <section className={card} data-testid="venue-reviews">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className={heading}>Ratings & reviews</h2>
        {summary.count > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold tracking-tight" data-testid="reviews-avg">{summary.avg.toFixed(1)}</span>
            <div>
              <Stars value={summary.avg} />
              <div className="mt-0.5 text-xs text-[#8F8781]">{summary.count} review{summary.count === 1 ? "" : "s"}</div>
            </div>
          </div>
        )}
      </div>

      {summary.count > 0 && (
        <div className="mt-4 space-y-1.5 max-w-sm">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary.distribution[String(n)] || 0;
            return (
              <div key={n} className="flex items-center gap-3 text-xs text-[#8F8781]">
                <span className="w-3 tabular-nums">{n}</span>
                <div className="h-1.5 flex-1 rounded-full bg-[#23201E]">
                  <div className="h-full rounded-full bg-[#E8A33D]" style={{ width: `${(c / summary.count) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums">{c}</span>
              </div>
            );
          })}
        </div>
      )}

      {!user ? (
        <p className="mt-5 text-sm text-[#8F8781]">
          <Link to="/login" state={{ from: location }} className="font-bold text-[#EE9B79] hover:text-[#CE6A4A]">Sign in</Link>{" "}
          to rate this restaurant after you've dined here.
        </p>
      ) : !can_review ? (
        <p className="mt-5 text-sm text-[#8F8781]">Check in or dine here to leave a review.</p>
      ) : null}

      {showForm && (
        <ReviewForm
          venueId={venueId}
          mine={mine}
          onSaved={() => { setEditing(false); load(); }}
          onCancel={mine ? () => setEditing(false) : undefined}
        />
      )}

      {reviews.length > 0 ? (
        <ul className="mt-6 divide-y divide-white/[0.08]">
          {reviews.map((r) => (
            <li key={r.id} className="py-4" data-testid={`review-${r.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#33302D] text-sm font-extrabold text-[#EE9B79]">
                    {(r.member_name || "M").trim()[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{r.is_mine ? "You" : r.member_name}</div>
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} size="h-3.5 w-3.5" />
                      <span className="text-xs text-[#8F8781]">{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                </div>
                {r.is_mine && !editing && (
                  <div className="flex items-center gap-3 text-xs font-semibold text-[#8F8781]">
                    <button type="button" onClick={() => setEditing(true)} className="hover:text-white">Edit</button>
                    <button type="button" onClick={remove} aria-label="Delete review" className="hover:text-[#F87171]">
                      <Trash2 strokeWidth={1.6} className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {r.text && <p className="mt-2.5 text-[15px] leading-relaxed text-[#B8B2AA]">{r.text}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[#8F8781]">No reviews yet. Be the first once you've dined here.</p>
      )}
    </section>
  );
}
