import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useIsAdmin } from "@/lib/auth-context";
import { usePartners } from "@/lib/partnersService";
import { usePartnerForm } from "@/components/PartnerFormModal";
import { cn } from "@/lib/utils";

/** One pill per partner; the overview pill is active on Discover. */
export function RestaurantTabs({ activeSlug, className }) {
  const { data: partners = [] } = usePartners();
  const isAdmin = useIsAdmin();
  const { openPartnerForm } = usePartnerForm();

  const pill = (active) => cn("tbl-pill", active ? "tbl-pill--filled" : "tbl-pill--outline");

  return (
    <nav aria-label="Partners" className={cn("tbl-scroll-x -mx-1 px-1 mb-6", className)} data-testid="restaurant-tabs">
      <div className="flex items-center gap-1.5">
        <Link to="/discover" className={pill(!activeSlug)} aria-current={!activeSlug ? "page" : undefined}>
          All partners
        </Link>
        {partners.map((p) => (
          <Link
            key={p.id}
            to={`/restaurant/${p.slug}`}
            className={pill(p.slug === activeSlug)}
            aria-current={p.slug === activeSlug ? "page" : undefined}
            data-testid={`restaurant-tab-${p.slug}`}
          >
            {p.name}
          </Link>
        ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => openPartnerForm()}
            className="tbl-pill tbl-pill--tint"
            data-testid="add-partner-button"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Add partner
          </button>
        )}
      </div>
    </nav>
  );
}
