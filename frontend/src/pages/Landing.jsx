import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export default function Landing() {
  const { user } = useAuth();

  if (user && user !== false) {
    const dest = user.role === "staff" ? "/staff" : "/discover";
    return <Navigate to={dest} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F4F4EE] grid grid-cols-1 lg:grid-cols-12">
      {/* Text column — dominant on desktop */}
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
            <div className="overline mb-8">A nightlife collective · Est. 2026</div>
            <h1 className="font-serif-display text-5xl sm:text-6xl lg:text-8xl leading-[0.95] tracking-tight">
              Your evening
              <br />
              <span className="italic text-[#C2A36B]">follows</span> you.
            </h1>
            <p className="mt-10 max-w-lg text-[#F4F4EE]/70 text-base sm:text-lg font-light leading-relaxed">
              A single membership across the rooms that keep the late hours —
              the first cocktail, the long conversation, the last pour.
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

      {/* Editorial image column */}
      <div className="lg:col-span-5 relative min-h-[42vh] lg:min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1575444758702-4a6b9222336e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwyfHxsb3clMjBsaWdodCUyMGNvY2t0YWlsJTIwYmFyfGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0F0F0F]/30 to-[#0F0F0F]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
          <div className="overline mb-3 text-[#F4F4EE]/80">Currently</div>
          <div className="font-serif-display text-2xl lg:text-3xl italic text-[#F4F4EE]">
            {`"The last room before morning."`}
          </div>
          <div className="overline mt-3 text-[#C2A36B]">— Noctis, Chinatown</div>
        </div>
      </div>
    </div>
  );
}
