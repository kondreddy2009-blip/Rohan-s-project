import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { KeyRound, CalendarCheck, Gift, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { VenueCard } from "@/components/VenueCard";
import { Reveal } from "@/components/Reveal";

const QUOTES = [
  { text: "A bistro that stays until the last conversation.", venue: "Verre, West Village" },
  { text: "Twelve seats. One evening.", venue: "Ikigai, Downtown" },
  { text: "Long tables. Longer conversations.", venue: "Osteria Verde, Marais" },
  { text: "Small plates, unhurried nights.", venue: "La Petite, Belleville" },
  { text: "A single seating each night.", venue: "Salle Privée, Financial District" },
];

const HOW_IT_WORKS = [
  {
    icon: KeyRound,
    title: "One membership",
    body: "Join once. Your Table carries across every room in the collective — no separate accounts, no separate lines.",
  },
  {
    icon: CalendarCheck,
    title: "Check in anywhere",
    body: "Walk into any of the six rooms and check in. Every visit, at every venue, builds the same standing.",
  },
  {
    icon: Gift,
    title: "Earn as you go",
    body: "Points and perks accrue automatically — quiet upgrades, held tables, and access that grows with you.",
  },
];

const TIERS = [
  { name: "Guest", detail: "Your first seat at the table. Full access to every room." },
  { name: "Regular", detail: "Recognized on arrival. Priority holds during peak hours." },
  { name: "Insider", detail: "Chef's-table access and early word on new openings." },
  { name: "Inner Circle", detail: "Standing reservations and a direct line to the collective." },
];

export default function Landing() {
  const { user } = useAuth();
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuoteIdx((i) => (i + 1) % QUOTES.length);
        setFadeIn(true);
      }, 400);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/venues")
      .then(({ data }) => {
        if (!cancelled) setVenues(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => venues.slice(0, 3), [venues]);

  if (user && user !== false) {
    const dest = user.role === "staff" ? "/staff" : "/discover";
    return <Navigate to={dest} replace />;
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div className="min-h-screen bg-[#1A0912] text-[#F4E8DA] grid grid-cols-1 lg:grid-cols-12">
      <div className="lg:col-span-7 relative flex flex-col px-6 sm:px-12 lg:px-20 py-10 lg:py-16">
        <header className="flex items-center justify-between">
          <div className="overline-accent">Table</div>
          <Link
            to="/login"
            data-testid="landing-signin-link"
            className="overline hover:text-[#C2A36B] transition-colors duration-300"
          >
            Sign in
          </Link>
        </header>

        <div className="flex-1 flex flex-col justify-center py-12 lg:py-0">
          <div className="animate-fade-up">
            <div className="overline mb-8 inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-[#C2A36B] status-dot-pulse" />
              A restaurant collective · Est. 2026
            </div>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight">
              Your table
              <br />
              <span className="italic text-[#C2A36B]">follows</span> you.
            </h1>
            <p className="mt-10 max-w-lg text-[#F4E8DA]/70 text-base sm:text-lg font-light leading-relaxed">
              A single membership across the city&apos;s best rooms — the
              neighborhood bistro, the omakase counter, the counter of ten.
              One night at any of them; points at every one after.
            </p>
          </div>

          <div className="mt-14 animate-fade-up delay-200 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link
              to="/login"
              data-testid="landing-enter-button"
              className="btn-primary inline-block"
            >
              Enter the Collective
            </Link>
            <div className="overline">
              Guest · Regular · Insider · Inner Circle
            </div>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-4 max-w-md animate-fade-up delay-300">
            <div>
              <div className="font-serif-display text-3xl text-[#C2A36B]">6</div>
              <div className="overline mt-1">Rooms</div>
            </div>
            <div>
              <div className="font-serif-display text-3xl text-[#C2A36B]">4</div>
              <div className="overline mt-1">Tiers</div>
            </div>
            <div>
              <div className="font-serif-display text-3xl text-[#C2A36B]">∞</div>
              <div className="overline mt-1">Perks</div>
            </div>
          </div>
        </div>

        <footer className="hairline-t pt-6 mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="overline">Est. 2026</div>
        </footer>
      </div>

      <div className="lg:col-span-5 relative min-h-[42vh] lg:min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1551218808-94e220e084d2?crop=entropy&cs=srgb&fm=jpg&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#1A0912]/30 to-[#1A0912]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0912]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
          <div className="overline mb-3 text-[#F4E8DA]/80">Currently</div>
          <div
            key={quoteIdx}
            className={`font-serif-display text-2xl lg:text-3xl italic text-[#F4E8DA] transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
            data-testid="landing-quote"
          >
            {`"${quote.text}"`}
          </div>
          <div
            className={`overline mt-3 text-[#C2A36B] transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
          >
            — {quote.venue}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* About / how it works                                             */}
      {/* --------------------------------------------------------------- */}
      <div className="lg:col-span-12 hairline-t px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
        <Reveal className="max-w-2xl">
          <div className="overline mb-5">About Table</div>
          <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl leading-[1.05]">
            Not a reservation app.
            <br />
            <span className="italic text-[#C2A36B]">A standing invitation.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[#F4E8DA]/70 text-base font-light leading-relaxed">
            Table is a single membership across a small, curated collective of
            rooms — the neighborhood bistro, the omakase counter, the counter
            of ten. One card, every venue, one continuous relationship instead
            of six separate ones.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
          {HOW_IT_WORKS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120} data-testid={`how-it-works-${i}`}>
              <step.icon strokeWidth={1.2} className="h-6 w-6 text-[#C2A36B]" />
              <h3 className="font-serif-display text-2xl mt-5 mb-2">{step.title}</h3>
              <p className="text-[#F4E8DA]/65 text-sm font-light leading-relaxed max-w-xs">
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Explore / discover preview                                       */}
      {/* --------------------------------------------------------------- */}
      {preview.length > 0 && (
        <div className="lg:col-span-12 hairline-t px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
          <Reveal className="flex items-end justify-between flex-wrap gap-6">
            <div>
              <div className="overline mb-5">Explore</div>
              <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl leading-[1.05]">
                Six rooms, <span className="italic text-[#C2A36B]">one card.</span>
              </h2>
            </div>
            <Link
              to="/login"
              data-testid="landing-explore-link"
              className="overline inline-flex items-center gap-2 text-[#C2A36B] hover:text-[#F4E8DA] transition-colors duration-300"
            >
              Discover every room
              <ArrowRight strokeWidth={1.4} className="h-3.5 w-3.5" />
            </Link>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {preview.map((v, i) => (
              <VenueCard venue={v} index={i} key={v.id} />
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* Tiers                                                            */}
      {/* --------------------------------------------------------------- */}
      <div className="lg:col-span-12 hairline-t px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
        <Reveal>
          <div className="overline mb-5">Standing</div>
          <h2 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl leading-[1.05] max-w-xl">
            Membership that <span className="italic text-[#C2A36B]">grows quietly.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#4E1E32]">
          {TIERS.map((tier, i) => (
            <Reveal
              key={tier.name}
              delay={i * 100}
              data-testid={`landing-tier-${tier.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="bg-[#1A0912] p-8"
            >
              <div className="overline text-[#C2A36B]">{`0${i + 1}`}</div>
              <h3 className="font-serif-display text-2xl mt-4 mb-3">{tier.name}</h3>
              <p className="text-[#F4E8DA]/65 text-sm font-light leading-relaxed">
                {tier.detail}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Link to="/login" data-testid="landing-footer-cta" className="btn-primary inline-block">
            Enter the Collective
          </Link>
          <div className="overline">Est. 2026</div>
        </Reveal>
      </div>
    </div>
  );
}
