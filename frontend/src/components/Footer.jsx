import { Link } from "react-router-dom";

const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "";

const COLUMNS = [
  {
    title: "Table",
    links: [
      { to: "/discover", label: "Restaurants" },
      { to: "/about", label: "About" },
      { to: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Members",
    links: [
      { to: "/login", label: "Sign in" },
      { to: "/bookings", label: "My reservations" },
      { to: "/wallet", label: "Wallet" },
    ],
  },
  {
    title: "Restaurants",
    links: [{ to: "/restaurant-login", label: "List your restaurant" }],
  },
  {
    title: "Legal",
    links: [
      { to: "/terms", label: "Terms of use" },
      { to: "/privacy", label: "Privacy policy" },
      { to: "/refunds", label: "Cancellation & refunds" },
      { to: "/pricing", label: "Pricing" },
      { to: "/shipping", label: "Shipping & delivery" },
      { to: "/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#110C09] text-[#8E8982]" data-testid="site-footer">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10 lg:px-16 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F4F1EC]/70">{col.title}</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs">
          <span>© {new Date().getFullYear()} Table. Dine · Earn · Return.</span>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white transition-colors">{SUPPORT_EMAIL}</a>
          )}
        </div>
      </div>
    </footer>
  );
}
