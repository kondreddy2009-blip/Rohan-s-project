import { PARTNER_FILTERS } from "@/lib/partnersService";
import { cn } from "@/lib/utils";

export function FilterChips({ value, onChange, className }) {
  return (
    <div className={cn("flex items-center gap-2 tbl-scroll-x", className)} role="group" aria-label="Filter partners">
      {PARTNER_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          aria-pressed={value === f.key}
          data-testid={`filter-${f.key}`}
          className={cn("tbl-pill tbl-pill--lg", value === f.key ? "tbl-pill--light" : "tbl-pill--filled")}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
