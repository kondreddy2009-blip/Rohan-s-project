import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Compass, Wallet, User, LayoutDashboard, LogOut, ScanLine, ChevronLeft, CalendarCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

function NavItem({ to, icon: Icon, label, testId, staff }) {
  return (
    <NavLink
      to={to}
      data-testid={testId}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 py-2 transition-colors duration-300",
          staff
            ? isActive
              ? "text-[color:var(--st-gold)]"
              : "text-[color:var(--st-muted)] hover:text-[color:var(--st-text)]"
            : isActive
              ? "text-[#F4764F]"
              : "text-[#8E8982] hover:text-white",
        )
      }
      end
    >
      <Icon strokeWidth={1.6} className="h-6 w-6" />
      <span className="text-[12px] font-semibold">{label}</span>
    </NavLink>
  );
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isStaffContext =
    location.pathname.startsWith("/staff") && user && (user.role === "staff" || user.role === "admin");

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (location.pathname === "/discover") return <>{children}</>;

  return (
    <div
      className={cn(
        "min-h-screen pb-24",
        isStaffContext
          ? "bg-[color:var(--st-page)] text-[color:var(--st-text)]"
          : "bg-[#141312] text-[#F4F1EC]",
      )}
    >
      {/* Header */}
      <header className={cn(
          "sticky top-0 z-40 backdrop-blur-xl",
          isStaffContext ? "bg-[rgb(var(--st-page-rgb)/0.9)] sm:hidden" : "bg-[#141312]/90",
        )}>
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {location.pathname !== "/discover" && (
              <button
                onClick={() => navigate(-1)}
                aria-label="Back"
                data-testid="venue-back-button"
                className={isStaffContext ? "text-[color:var(--st-gold)]" : "text-[#F4764F]"}
              >
                <ChevronLeft strokeWidth={1.8} className="h-5 w-5" />
              </button>
            )}
            <Link to={user ? "/discover" : "/"} data-testid="brand-home-link">
              <BrandLockup />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {user === false && (
              <Link
                to="/login"
                state={{ from: location }}
                data-testid="header-signin"
                className="rounded-full bg-[#F4764F] px-4 py-2 text-sm font-extrabold text-[#1A0F0B] hover:bg-[#F78963] transition-colors"
              >
                Sign in
              </Link>
            )}
            {user && (
              <button
                onClick={handleLogout}
                data-testid="logout-button"
                aria-label="Sign out"
                className={cn("transition-colors duration-300", isStaffContext ? "text-[color:var(--st-gold)]" : "text-[#F4764F]")}
              >
                <LogOut strokeWidth={1.6} className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>
      {!isStaffContext && <Footer />}

      {/* Bottom nav for members */}
      {user && !isStaffContext && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] backdrop-blur-xl bg-[#141312]/95"
          data-testid="bottom-nav"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-5">
            <NavItem to="/discover" icon={Compass} label="Discover" testId="nav-discover" />
            <NavItem to="/bookings" icon={CalendarCheck} label="Bookings" testId="nav-bookings" />
            <NavItem to="/scan" icon={ScanLine} label="Scan" testId="nav-scan" />
            <NavItem to="/wallet" icon={Wallet} label="Wallet" testId="nav-wallet" />
            <NavItem to="/profile" icon={User} label="Profile" testId="nav-profile" />
          </div>
        </nav>
      )}

      {/* Staff sub-nav is inside StaffDashboard */}
      {user && isStaffContext && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-[color:var(--st-border)] backdrop-blur-xl bg-[rgb(var(--st-page-rgb)/0.95)]"
          data-testid="staff-bottom-nav"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-1">
            <NavItem to="/staff" icon={LayoutDashboard} label="Dashboard" testId="nav-staff-dashboard" staff />
          </div>
        </nav>
      )}
    </div>
  );
}
