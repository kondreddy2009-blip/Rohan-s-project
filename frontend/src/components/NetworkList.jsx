import { Link } from "react-router-dom";
import { StatusDot } from "@/components/StatusPill";
import { partnerStatus } from "@/lib/partnersService";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

export function NetworkList({ partners, className }) {
  const rows = partners.slice(0, MAX_ROWS);
  return (
    <div className={cn("tbl-panel p-5 flex flex-col", className)} data-testid="network-list">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold tracking-[-0.01em] whitespace-nowrap">Tonight across the network</h2>
        <Link to="/events" className="text-[13px] font-semibold text-ritual-accent hover:text-ritual-accent-hover">
          Events
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-ritual-muted">No partners match this filter.</p>
      ) : (
        <ul className="mt-2 tbl-divide">
          {rows.map((p) => {
            const s = partnerStatus(p);
            return (
              <li key={p.id}>
                <Link
                  to={`/restaurant/${p.slug}`}
                  className="flex items-center gap-3 py-3 group"
                  data-testid={`network-row-${p.slug}`}
                >
                  <StatusDot tone={s.tone} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold truncate group-hover:text-ritual-accent-hover transition-colors">
                      {p.name}
                    </span>
                    <span className="block text-[13px] text-ritual-muted truncate">
                      {p.area} · {p.cuisine}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold whitespace-nowrap">{s.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {partners.length > MAX_ROWS && (
        <a href="#filling-in-fast" className="mt-auto pt-3 text-[12px] font-semibold text-ritual-muted hover:text-ritual-text">
          +{partners.length - MAX_ROWS} more partners
        </a>
      )}
    </div>
  );
}
