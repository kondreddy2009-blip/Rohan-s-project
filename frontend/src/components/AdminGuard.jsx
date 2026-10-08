import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { usePartners } from "@/lib/partnersService";
import { usePartnerForm } from "@/components/PartnerFormModal";

/** Renders children for admins only; everyone else lands on Discover. */
export function AdminGuard({ children }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  if (user === null) return null;
  if (!isAdmin) return <Navigate to="/discover" replace />;
  return children;
}

/** /admin/partners/new and /admin/partners/:slug/edit — open the form over the right page. */
export function AdminPartnerFormRoute() {
  const { slug } = useParams();
  const { openPartnerForm } = usePartnerForm();
  const { data: partners, isLoading } = usePartners();
  const partner = slug ? partners?.find((p) => p.slug === slug) : null;

  useEffect(() => {
    if (!slug) openPartnerForm();
    else if (partner) openPartnerForm(partner);
  }, [slug, partner, openPartnerForm]);

  if (slug && isLoading) return null;
  return <Navigate to={partner ? `/restaurant/${partner.slug}` : "/discover"} replace />;
}
