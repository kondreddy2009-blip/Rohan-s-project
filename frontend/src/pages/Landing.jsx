import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

const QUOTES = [
  { text: "A bistro that stays until the last conversation.", venue: "Verre, West Village" },
  { text: "Twelve seats. One evening.", venue: "Ikigai, Downtown" },
  { text: "Long tables. Longer conversations.", venue: "Osteria Verde, Marais" },
  { text: "Small plates, unhurried nights.", venue: "La Petite, Belleville" },
  { text: "A single seating each night.", venue: "Salle Privée, Financial District" },
];

export default function Landing() {
  const { user } = useAuth();
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

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

  if (user && user !== false) {
    const dest = user.role === "staff" ? "/staff" : "/discover";
    return <Navigate to={dest} replace />;
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div className="min-h-screen bg-[#0B0A0A] text-[#F2EDE7] grid grid-cols-1 lg:grid-cols-12">
      <div className="lg:col-span-7 relative flex flex-col px-6 sm:px-12 lg:px-20 py-10 lg:py-16">
        <header className="flex items-center justify-between">
          <div className="overline-accent">Table</div>
          <Link
            to="/login"
            data-testid="landing-signin-link"
            className="overline hover:text-[#CE6A4A] transition-colors duration-300"
          >
            Sign in
          </Link>
        </header>

        <div className="flex-1 flex flex-col justify-center py-12 lg:py-0">
          <div className="animate-fade-up">
            <div className="overline mb-8 inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-[#CE6A4A] status-dot-pulse" />
              A restaurant collective · Est. 2026
            </div>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight">
              Your table
              <br />
              <span className="text-[#CE6A4A]">follows</span> you.
            </h1>
            <p className="mt-10 max-w-lg text-[#F2EDE7]/70 text-base sm:text-lg font-light leading-relaxed">
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
              <div className="font-serif-display text-3xl text-[#CE6A4A]">6</div>
              <div className="overline mt-1">Rooms</div>
            </div>
            <div>
              <div className="font-serif-display text-3xl text-[#CE6A4A]">4</div>
              <div className="overline mt-1">Tiers</div>
            </div>
            <div>
              <div className="font-serif-display text-3xl text-[#CE6A4A]">∞</div>
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
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0B0A0A]/30 to-[#0B0A0A]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A0A]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
          <div className="overline mb-3 text-[#F2EDE7]/80">Currently</div>
          <div
            key={quoteIdx}
            className={`font-serif-display text-2xl lg:text-3xl text-[#F2EDE7] transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
            data-testid="landing-quote"
          >
            {`"${quote.text}"`}
          </div>
          <div
            className={`overline mt-3 text-[#CE6A4A] transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
          >
            — {quote.venue}
          </div>
        </div>
      </div>
    </div>
  );
}
