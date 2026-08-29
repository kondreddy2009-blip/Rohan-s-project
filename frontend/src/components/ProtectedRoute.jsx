import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export function ProtectedRoute({ children, staff = false }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1424]" data-testid="auth-loading">
        <div className="overline text-[#8996B0]">Loading</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (staff && user.role !== "staff" && user.role !== "admin") {
    return <Navigate to="/discover" replace />;
  }
  return children;
}
