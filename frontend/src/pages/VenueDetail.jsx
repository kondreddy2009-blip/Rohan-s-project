import { Navigate, useParams } from "react-router-dom";
import { usePartners } from "@/lib/partnersService";

/** Old /venues/:id links (check-in, redeem, staff) now land on the restaurant tab. */
export default function VenueDetail() {
  const { id } = useParams();
  const { data: partners, isLoading } = usePartners();
  if (isLoading) return null;
  const partner = partners?.find((p) => p.id === id);
  return <Navigate to={partner ? `/restaurant/${partner.slug}` : "/discover"} replace />;
}
