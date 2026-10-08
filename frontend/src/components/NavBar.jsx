import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { useStreak } from "@/lib/member";
import { cn } from "@/lib/utils";

const MEMBER_TABS = [
  { to: "/discover", label: "Discover", match: ["/discover", "/restaurant", "/admin"] },
  { to: "/events", label: "Events" },
  { to: "/wallet", label: "Wallet", match: ["/wallet", "/redeem"] },
  { to: "/profile", label: "Profile" },
];

const STAFF_TABS = [
  { to: "/discover", label: "Discover", match: ["/discover", "/restaurant"] },
  { to: "/staff", label: "Staff" },
  { to: "/profile", label: "Profile" },
];

function NavTab({ tab, pathname }) {
  return (
    <NavLink
      to={tab.to}
      data-testid={`nav-${tab.label.toLowerCase()}`}
      className={({ isActive }) => {
        const active = isActive || tab.match?.some((m) => pathname.startsWith(m));
        return cn("tbl-pill tbl-pill--lg", active ? "tbl-pill--filled" : "tbl-pill--ghost");
      }}
    >
      {tab.label}
    </NavLink>
  );
}

export function NavBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = useIsAdmin();
  const streak = useStreak();
  const tabs = user?.role === "staff" ? STAFF_TABS : MEMBER_TABS;
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <nav
      className="tbl-rule pb-5 mb-6 grid grid-cols-[1fr_auto] desk:grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3"
      aria-label="Main"
      data-testid="top-nav"
    >
      <Link
        to="/discover"
        className="col-start-1 row-start-1 inline-flex items-center gap-2.5"
        data-testid="brand-home-link"
      >
        <span className="tbl-square" aria-hidden="true">T</span>
        <span className="text-[17px] font-extrabold tracking-[-0.02em]">Table</span>
      </Link>

      <div className="tbl-scroll-x col-start-1 col-span-2 row-start-2 desk:col-start-2 desk:col-span-1 desk:row-start-1 desk:pl-4 -mx-1 px-1">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <NavTab key={t.to} tab={t} pathname={pathname} />
          ))}
        </div>
      </div>

      <div className="col-start-2 row-start-1 desk:col-start-3 flex items-center gap-2 justify-self-end">
        {streak > 0 && (
          <span className="tbl-pill tbl-pill--tint tbl-pill--lg" data-testid="nav-streak">
            {streak}-day streak
          </span>
        )}
        {isAdmin && (
          <span className="tbl-pill tbl-pill--filled text-ritual-muted" data-testid="nav-admin-pill">
            Admin
          </span>
        )}
        <Link
          to="/profile"
          className="tbl-square h-9 w-9 rounded-[10px]"
          aria-label={`${user?.name || "Your"} profile`}
          data-testid="nav-avatar"
        >
          {initial}
        </Link>
      </div>
    </nav>
  );
}
