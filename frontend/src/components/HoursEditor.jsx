import { Clock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGE_RE = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/g;
const pad = (n) => String(n).padStart(2, "0");

// "12:00 – 15:00, 19:00 – 23:00" -> [{ open: "12:00", close: "15:00" }, ...]
export function parseHours(str) {
  const rows = [...(str || "").matchAll(RANGE_RE)].map((m) => ({
    open: `${pad(m[1])}:${m[2]}`,
    close: `${pad(m[3])}:${m[4]}`,
  }));
  return rows.length ? rows : [{ open: "18:00", close: "23:00" }];
}

export function formatHours(rows) {
  return rows.map((r) => `${r.open} – ${r.close}`).join(", ");
}

const MAX_SERVICES = 4;

// Opening hours as time pickers. `value` is the stored string; `onChange` gets the new string.
export function HoursEditor({ value, onChange }) {
  const rows = parseHours(value);
  const update = (next) => onChange(formatHours(next));
  const setRow = (i, key, v) => update(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  const time =
    "rounded-xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-3 py-3 text-[15px] text-[color:var(--st-text)] outline-none focus:border-[color:var(--st-gold)] transition-colors [color-scheme:dark]";

  return (
    <div data-testid="profile-hours-editor">
      <div className="space-y-3">
        {rows.map((r, i) => {
          const overnight = r.close <= r.open;
          return (
            <div key={i} className="flex flex-wrap items-center gap-3" data-testid={`hours-row-${i}`}>
              <Clock strokeWidth={1.5} className="h-5 w-5 text-[color:var(--st-muted)]" />
              <label className="sr-only" htmlFor={`hours-open-${i}`}>Opens</label>
              <input
                id={`hours-open-${i}`}
                type="time"
                required
                value={r.open}
                onChange={(e) => setRow(i, "open", e.target.value)}
                data-testid={`hours-open-${i}`}
                className={time}
              />
              <span className="text-sm text-[color:var(--st-muted)]">to</span>
              <label className="sr-only" htmlFor={`hours-close-${i}`}>Closes</label>
              <input
                id={`hours-close-${i}`}
                type="time"
                required
                value={r.close}
                onChange={(e) => setRow(i, "close", e.target.value)}
                data-testid={`hours-close-${i}`}
                className={time}
              />
              {overnight && <span className="text-xs text-[color:var(--st-muted)]">closes after midnight</span>}
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => update(rows.filter((_, j) => j !== i))}
                  aria-label="Remove this service"
                  data-testid={`hours-remove-${i}`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--st-border)] text-[color:var(--st-muted)] transition-colors hover:text-[color:var(--st-text)]"
                >
                  <X strokeWidth={1.6} className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {rows.length < MAX_SERVICES && (
          <button
            type="button"
            onClick={() => update([...rows, { open: "19:00", close: "23:00" }])}
            data-testid="hours-add"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-[color:var(--st-border)] px-4 py-2 text-sm font-semibold",
              "text-[color:var(--st-gold)] transition-colors hover:border-[color:var(--st-gold)]",
            )}
          >
            <Plus strokeWidth={1.8} className="h-4 w-4" />
            Add another service
          </button>
        )}
        <span className="text-xs text-[color:var(--st-muted)]">
          Outside these hours your restaurant shows as <b>Closed</b> to guests, and past times can&apos;t be booked.
        </span>
      </div>
    </div>
  );
}
