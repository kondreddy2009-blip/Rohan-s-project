import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export default function Landing() {
  const { user } = useAuth();

  if (user && user !== false) return <Navigate to="/discover" replace />;

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F4F4EE] grid grid-cols-1 lg:grid-cols-12">
      {/* Text column — dominant on desktop */}
      <div className="lg:col-span-7 relative flex flex-col px-6 sm:px-12 lg:px-20 py-10 lg:py-16">
        <header className="flex items-center justify-between">
          <div className="overline-accent">Ritual</div>
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
            <div className="overline mb-8">A cross-venue collective · Est. 2026</div>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight">
              Your loyalty
              <br />
              <span className="italic text-[#C2A36B]">follows</span> you.
            </h1>
            <p className="mt-10 max-w-lg text-[#F4F4EE]/70 text-base sm:text-lg font-light leading-relaxed">
              A single membership across the rooms you already move
              between — the quiet lunch, the last cocktail, and everything
              considered in between.
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
              Guest · Regular · Devotee · Inner Circle
            </div>
          </div>
        </div>

        <footer className="hairline-t pt-6 mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="overline">Six rooms · One membership</div>
          <div className="overline">A quiet correspondence</div>
        </footer>
      </div>

      {/* Editorial image column */}
      <div className="lg:col-span-5 relative min-h-[42vh] lg:min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHw0fHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0F0F0F]/30 to-[#0F0F0F]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
          <div className="overline mb-3 text-[#F4F4EE]/80">Currently</div>
          <div className="font-serif-display text-2xl lg:text-3xl italic text-[#F4F4EE]">
            "A room that keeps its own hours."
          </div>
          <div className="overline mt-3 text-[#C2A36B]">— Verre, West Village</div>
        </div>
      </div>
    </div>
  );
}
