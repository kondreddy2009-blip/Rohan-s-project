import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Compass, Wallet, User, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function NavItem({ to, icon: Icon, label, testId }) {
  return (
    <NavLink
      to={to}
      data-testid={testId}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 py-2 transition-colors duration-300",
          isActive ? "text-[#C2A36B]" : "text-[#8E8E8E] hover:text-[#F4F4EE]",
        )
      }
      end
    >
      <Icon strokeWidth={1.2} className="h-5 w-5" />
      <span className="text-[10px] tracking-[0.18em] uppercase">{label}</span>
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

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F4F4EE] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0F0F0F]/70 border-b border-white/[0.04]">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
          <Link to={user ? "/discover" : "/"} data-testid="brand-home-link" className="group">
            <div className="overline-accent">Ritual</div>
            <div className="font-serif-display text-lg leading-none text-[#F4F4EE] mt-0.5">
              {isStaffContext ? "Staff" : "Members"}
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <button
                onClick={handleLogout}
                data-testid="logout-button"
                aria-label="Sign out"
                className="text-[#8E8E8E] hover:text-[#F4F4EE] transition-colors duration-300"
              >
                <LogOut strokeWidth={1.2} className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Bottom nav for members */}
      {user && !isStaffContext && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.04] backdrop-blur-xl bg-[#0F0F0F]/85"
          data-testid="bottom-nav"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-3 sm:grid-cols-3">
            <NavItem to="/discover" icon={Compass} label="Discover" testId="nav-discover" />
            <NavItem to="/wallet" icon={Wallet} label="Wallet" testId="nav-wallet" />
            <NavItem to="/profile" icon={User} label="Profile" testId="nav-profile" />
          </div>
        </nav>
      )}

      {/* Staff sub-nav is inside StaffDashboard */}
      {user && isStaffContext && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.04] backdrop-blur-xl bg-[#0F0F0F]/85"
          data-testid="staff-bottom-nav"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-1">
            <NavItem to="/staff" icon={LayoutDashboard} label="Dashboard" testId="nav-staff-dashboard" />
          </div>
        </nav>
      )}
    </div>
  );
}
