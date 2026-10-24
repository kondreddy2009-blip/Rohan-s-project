import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, QrCode, Sparkles, Gift, Utensils } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BrandLockup } from "@/components/BrandLockup";
import { FillingFastCard } from "@/components/FillingFastCard";
import { Footer } from "@/components/Footer";
import { usePageTitle } from "@/lib/usePageTitle";

const STEPS = [
  { icon: Utensils, title: "Dine anywhere", body: "Book a table or walk in at any partner restaurant in the network." },
  { icon: QrCode, title: "Check in & earn", body: "Scan the code at the table. Every visit earns you points, no receipts to upload." },
  { icon: Gift, title: "Redeem where you earned", body: "Your points are yours at the restaurant that gave them, redeemed for perks right there." },
];

const TIERS = [
  { name: "Guest", pts: 0, note: "Start earning from your first visit" },
  { name: "Regular", pts: 500, note: "Complimentary signatures and early access" },
  { name: "Insider", pts: 1500, note: "Curated tastings and chef's counter" },
  { name: "Inner Circle", pts: 3000, note: "The network's most exclusive tables" },
];

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#CE6A4A] px-7 py-3.5 text-[15px] font-extrabold text-[#0B0A0A] hover:bg-[#E8A06E] transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 text-[15px] font-bold text-white hover:bg-white/5 transition-colors";
const wrap = "mx-auto max-w-[1280px] px-5 sm:px-10 lg:px-16";

export default function Landing() {
  usePageTitle();
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    api.get("/venues").then(({ data }) => setVenues(data)).catch(() => {});
  }, []);

  if (user) {
    return <Navigate to={user.role === "staff" ? "/staff" : "/discover"} replace />;
  }

  const hero = venues.find((v) => v.featured) || venues[0];
  const featured = venues.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#121110] text-[#F2EDE7]" data-testid="landing-page">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className={`${wrap} flex items-center justify-between py-4`}>
          <Link to="/" aria-label="Table home"><BrandLockup /></Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link to="/discover" className="hidden sm:inline px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
              Restaurants
            </Link>
            <Link to="/login" data-testid="landing-signin" className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
              Sign in
            </Link>
            <Link
              to="/login"
              state={{ mode: "create" }}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#121110] hover:bg-white/90 transition-colors"
            >
              Join free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[640px] sm:min-h-[720px] overflow-hidden">
        {hero && <img src={hero.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121110] via-[#121110]/60 to-[#121110]/40" />
        <div className={`${wrap} relative flex min-h-[640px] sm:min-h-[720px] flex-col justify-end pb-16 sm:pb-24 pt-36`}>
          <div className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#EE9B79]">Dine · Earn · Return</div>
          <h1 className="mt-4 max-w-3xl text-5xl sm:text-7xl font-extrabold tracking-[-0.045em] leading-[0.98]">
            One membership.<br />Every table.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            Earn points at the restaurants you love and redeem them there, while one membership tier
            follows you to every room. Table is the loyalty and reservations network for places worth returning to.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/discover" className={btnPrimary} data-testid="landing-explore">
              Explore restaurants <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" state={{ mode: "create" }} className={btnGhost}>
              Join free
            </Link>
          </div>
          {venues.length > 0 && (
            <div className="mt-10 flex items-center gap-2 text-sm font-semibold text-white/70">
              <span className="h-2 w-2 rounded-full bg-[#7DBE8A]" />
              {venues.length} partner restaurants live now
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className={`${wrap} py-20`}>
        <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8F8781]">How it works</div>
        <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]">Loyalty that rewards your regular tables</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl bg-[#1B1917] p-7">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#33302D] text-[#EE9B79]">
                  <s.icon strokeWidth={1.6} className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-[#8F8781]">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#B8B2AA]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Restaurants */}
      {featured.length > 0 && (
        <section className="border-t border-white/[0.06] py-20">
          <div className={wrap}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8F8781]">The network</div>
                <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]">Rooms on Table</h2>
              </div>
              <Link to="/discover" className="text-sm font-bold text-[#EE9B79] hover:text-[#CE6A4A] whitespace-nowrap">
                See all →
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.map((v) => <FillingFastCard venue={v} key={v.id} />)}
            </div>
          </div>
        </section>
      )}

      {/* Tiers */}
      <section className="border-t border-white/[0.06] py-20">
        <div className={wrap}>
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8F8781]">Membership</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]">The more you dine, the more opens up</h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((t, i) => (
              <div
                key={t.name}
                className={
                  i === TIERS.length - 1
                    ? "rounded-2xl p-6 bg-gradient-to-br from-[#CC6A4C] to-[#8E4132] text-[#0B0A0A]"
                    : "rounded-2xl p-6 bg-[#1B1917]"
                }
              >
                <Sparkles strokeWidth={1.6} className="h-5 w-5 opacity-70" />
                <div className="mt-4 text-2xl font-extrabold tracking-tight">{t.name}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                  {t.pts === 0 ? "Free to join" : `${t.pts.toLocaleString("en-IN")} pts`}
                </div>
                <p className="mt-3 text-sm leading-relaxed opacity-80">{t.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + restaurants */}
      <section className="border-t border-white/[0.06] py-20">
        <div className={`${wrap} grid grid-cols-1 md:grid-cols-2 gap-4`}>
          <div className="rounded-2xl bg-[#1B1917] p-8 sm:p-10">
            <h3 className="text-3xl font-extrabold tracking-[-0.03em]">Ready for your first table?</h3>
            <p className="mt-3 text-[#B8B2AA]">Free to join. Your points start the moment you check in.</p>
            <Link to="/login" state={{ mode: "create" }} className={`${btnPrimary} mt-6`}>Create your account</Link>
          </div>
          <div className="rounded-2xl border border-white/10 p-8 sm:p-10">
            <h3 className="text-3xl font-extrabold tracking-[-0.03em]">Own a restaurant?</h3>
            <p className="mt-3 text-[#B8B2AA]">Fill tables, reward regulars and get discovered by members across the network.</p>
            <Link to="/restaurant-login" className={`${btnGhost} mt-6`}>List your restaurant</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
