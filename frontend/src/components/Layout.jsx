import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Compass, Wallet, LayoutDashboard, LogOut, ScanLine, ChevronLeft, CalendarCheck, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { Footer } from "@/components/Footer";
import { SiteHeader, isNavActive } from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

function NavItem({ to, icon: Icon, label, testId, staff }) {
  const location = useLocation();
  return (
    <NavLink
      to={to}
      data-testid={testId}
      className={({ isActive: routeActive }) => {
        const isActive = staff ? routeActive : isNavActive(to, location);
        return cn(
          "flex flex-col items-center gap-1 py-2 transition-colors duration-300",
          staff
            ? isActive
              ? "text-[color:var(--st-gold)]"
              : "text-[color:var(--st-muted)] hover:text-[color:var(--st-text)]"
            : isActive
              ? "text-[#CE6A4A]"
              : "text-[#8F8781] hover:text-white",
        );
      }}
      end
    >
      <Icon strokeWidth={1.6} className="h-6 w-6" />
      <span className="text-[12px] font-semibold">{label}</span>
    </NavLink>
  );
}

const MEMBER_NAV = [
  { to: "/discover", icon: Compass, label: "Discover", testId: "nav-discover" },
  { to: "/events", icon: CalendarDays, label: "Events", testId: "nav-events" },
  { to: "/bookings", icon: CalendarCheck, label: "Bookings", testId: "nav-bookings" },
  { to: "/scan", icon: ScanLine, label: "Scan", testId: "nav-scan" },
  { to: "/wallet", icon: Wallet, label: "Wallet", testId: "nav-wallet" },
];

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

  const isMember = !!user && !isStaffContext;
  if (location.pathname === "/discover") return <>{children}</>;

  return (
    <div
      className={cn(
        "min-h-screen pb-24",
        isMember && "md:pb-0",
        isStaffContext
          ? "bg-[color:var(--st-page)] text-[color:var(--st-text)]"
          : "bg-[#0B0A0A] text-[#F2EDE7]",
      )}
    >
      {/* Header: one shared header for members and visitors; staff keep their own */}
      {!isStaffContext && (
        <div className="px-5 sm:px-10 lg:px-16 py-6">
          <div className="mx-auto max-w-[1280px]">
            <SiteHeader />
          </div>
        </div>
      )}
      {isStaffContext && (
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgb(var(--st-page-rgb)/0.9)] sm:hidden">
          <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                aria-label="Back"
                data-testid="venue-back-button"
                className="text-[color:var(--st-gold)]"
              >
                <ChevronLeft strokeWidth={1.8} className="h-5 w-5" />
              </button>
              <Link to="/discover" data-testid="brand-home-link">
                <BrandLockup />
              </Link>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              aria-label="Sign out"
              className="text-[color:var(--st-gold)] transition-colors duration-300"
            >
              <LogOut strokeWidth={1.6} className="h-5 w-5" />
            </button>
          </div>
        </header>
      )}

      <main>{children}</main>
      {!isStaffContext && <Footer />}

      {/* Bottom nav for members */}
      {user && !isStaffContext && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] backdrop-blur-xl bg-[#0B0A0A]/95 md:hidden"
          data-testid="bottom-nav"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-5">
            {MEMBER_NAV.map((n) => (
              <NavItem key={n.to} to={n.to} icon={n.icon} label={n.label} testId={n.testId} />
            ))}
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
