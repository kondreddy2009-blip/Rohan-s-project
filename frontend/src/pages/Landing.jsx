import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

const QUOTES = [
  { text: "The last room before morning.", venue: "Noctis, Chinatown" },
  { text: "A bistro that stays until the last conversation.", venue: "Verre, West Village" },
  { text: "Above the noise.", venue: "Lumen, Downtown" },
  { text: "A room behind a room.", venue: "Chambre No. 7, Mayfair" },
  { text: "Natural wine, poured with patience.", venue: "Auréole, Belleville" },
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
    <div className="min-h-screen bg-[#0A1424] text-[#E8ECF5] grid grid-cols-1 lg:grid-cols-12">
      <div className="lg:col-span-7 relative flex flex-col px-6 sm:px-12 lg:px-20 py-10 lg:py-16">
        <header className="flex items-center justify-between">
          <div className="overline-accent">Nocturne</div>
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
              A nightlife collective · Est. 2026
            </div>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight">
              Your evening
              <br />
              <span className="italic text-[#C2A36B]">follows</span> you.
            </h1>
            <p className="mt-10 max-w-lg text-[#E8ECF5]/70 text-base sm:text-lg font-light leading-relaxed">
              A single membership across the rooms that keep the late
              hours — the first cocktail, the long conversation, the last pour.
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
        </div>

        <footer className="hairline-t pt-6 mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="overline">Est. 2026</div>
        </footer>
      </div>

      <div className="lg:col-span-5 relative min-h-[42vh] lg:min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1575444758702-4a6b9222336e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwyfHxsb3clMjBsaWdodCUyMGNvY2t0YWlsJTIwYmFyfGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0A1424]/30 to-[#0A1424]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1424]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
          <div className="overline mb-3 text-[#E8ECF5]/80">Currently</div>
          <div
            key={quoteIdx}
            className={`font-serif-display text-2xl lg:text-3xl italic text-[#E8ECF5] transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}
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
    </div>
  );
}
