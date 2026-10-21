import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Compass, CalendarDays, CalendarCheck, Wallet, Star, ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { cn } from "@/lib/utils";

export const CORAL_BTN = "bg-[#F07F5E] text-[#2A0F07] hover:bg-[#F59273]";
const pillBase = "rounded-full border border-white/10 bg-[#17110C]/90 backdrop-blur-sm";

const NAV = [
  { label: "Discover", to: "/discover", icon: Compass, testId: "nav-discover" },
  { label: "Events", to: "/events", icon: CalendarDays, testId: "nav-events" },
  { label: "Bookings", to: "/bookings", icon: CalendarCheck, testId: "nav-bookings", members: true },
  { label: "Wallet", to: "/wallet", icon: Wallet, testId: "nav-wallet", members: true },
];

const MAIN_PATHS = ["/discover", "/events", "/bookings", "/wallet", "/profile", "/scan"];

export function isNavActive(to, location) {
  return location.pathname === to;
}

// The one site-wide header: logo, pill nav, points + avatar. Used on every page except staff.
export function SiteHeader({ points }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = !!user;
  const nav = NAV.filter((n) => signedIn || !n.members);
  const pts = points ?? user?.lifetime_points ?? 0;
  const showBack = !MAIN_PATHS.includes(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="relative z-20 grid grid-cols-[auto_1fr_auto] items-center gap-4" data-testid="site-header">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            data-testid="venue-back-button"
            className={cn(pillBase, "grid h-10 w-10 place-items-center text-[#E8C9A0] hover:text-white")}
          >
            <ChevronLeft strokeWidth={1.8} className="h-5 w-5" />
          </button>
        )}
        <Link to={signedIn ? "/discover" : "/"} data-testid="brand-home-link" className="shrink-0">
          <BrandLockup />
        </Link>
      </div>

      <nav
        className={cn(pillBase, "mx-auto hidden md:flex max-w-full items-center gap-0.5 p-1.5")}
        data-testid="top-nav"
      >
        {nav.map(({ label, to, icon: Icon, testId }) => (
          <NavLink
            key={label}
            to={to}
            end
            data-testid={testId}
            aria-current={isNavActive(to, location) ? "page" : undefined}
            onClick={() => {
            }}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-3 text-[14px] font-medium transition-colors",
              isNavActive(to, location) ? "bg-[#2A2118] text-white" : "text-[#B8AA98] hover:text-white",
            )}
          >
            <Icon strokeWidth={1.5} className="h-5 w-5" />
            <span className="hidden xl:inline">{label}</span>
          </NavLink>
        ))}
      </nav>
      <span className="md:hidden" />

      <div className="flex items-center gap-3 shrink-0">
        {user === null ? null : signedIn ? (
          <>
            <Link
              to="/wallet"
              className={cn(pillBase, "hidden sm:inline-flex items-center gap-2 border-[#E8C9A0]/30 px-4 py-2.5 text-sm font-semibold text-white")}
            >
              <Star className="h-4 w-4 fill-[#E8C9A0] text-[#E8C9A0]" />
              {pts.toLocaleString("en-IN")} pts
            </Link>
            <Link
              to="/profile"
              aria-label="Profile"
              title={user.name || "Profile"}
              data-testid="header-profile-button"
              className="grid h-12 w-12 place-items-center rounded-full bg-[#E8805E] text-base font-semibold text-[#2A0F07] ring-1 ring-white/15 transition hover:brightness-110"
            >
              {(user.name || "G").trim()[0].toUpperCase()}
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              aria-label="Sign out"
              className="hidden sm:block text-[#B8AA98] hover:text-white transition-colors"
            >
              <LogOut strokeWidth={1.6} className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              state={{ from: location }}
              data-testid="header-signin"
              className="px-3 py-2 text-sm font-semibold text-[#B8B2AA] hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              state={{ mode: "create" }}
              className={cn("rounded-full px-5 py-2.5 text-sm font-extrabold transition-colors", CORAL_BTN)}
            >
              Join free
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
