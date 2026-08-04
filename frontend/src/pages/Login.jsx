import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  { email: "bhandariyashvee@gmail.com", label: "Owner · Admin (Insider)", password: "ritual2026" },
  { email: "mila@ritual.app", label: "Mila · Inner Circle", password: "ritual2026" },
  { email: "alex@ritual.app", label: "Alex · Regular", password: "ritual2026" },
  { email: "staff.lumen@ritual.app", label: "Staff · Lumen", password: "ritual2026" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("bhandariyashvee@gmail.com");
  const [password, setPassword] = useState("ritual2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user !== false) {
    const dest = user.role === "staff" ? "/staff" : "/discover";
    return <Navigate to={dest} replace />;
  }

  const doLogin = async (em, pw) => {
    setBusy(true);
    setError("");
    const res = await login(em, pw);
    setBusy(false);
    if (res.ok) {
      toast.success(`A table awaits, ${res.user.name.split(" ")[0]}.`);
      const dest = res.user.role === "staff" ? "/staff" : location.state?.from?.pathname || "/discover";
      navigate(dest, { replace: true });
    } else {
      setError(res.error);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F4F4EE] grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHw0fHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F0F0F]/50 to-[#0F0F0F]/85" />
        <div className="absolute inset-0 flex items-end p-12">
          <div>
            <div className="overline mb-6">Members</div>
            <h2 className="font-serif-display text-4xl leading-tight max-w-md">
              A quiet room, held open — regardless of the hour.
            </h2>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 sm:px-12 py-16">
        <div className="w-full max-w-sm animate-fade-up">
          <Link to="/" data-testid="login-brand-link" className="overline-accent">
            Ritual
          </Link>
          <h1 className="font-serif-display text-4xl mt-4 mb-10">Sign in</h1>

          <form onSubmit={submit} className="space-y-6" data-testid="login-form">
            <div>
              <label className="overline block mb-3">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="w-full bg-transparent border-b border-[#2A2A2A] py-2 text-[#F4F4EE] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="overline block mb-3">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="w-full bg-transparent border-b border-[#2A2A2A] py-2 text-[#F4F4EE] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="text-sm text-[#C08B70] font-light border-l-2 border-[#C08B70] pl-3"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit-button"
              className="btn-primary w-full mt-2"
            >
              {busy ? "One moment" : "Enter"}
            </button>
          </form>

          <div className="mt-12 pt-8 hairline-t">
            <div className="overline mb-4">Explore as a demo guest</div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    doLogin(a.email, a.password);
                  }}
                  disabled={busy}
                  data-testid={`demo-login-${a.email}`}
                  className="w-full text-left px-4 py-3 border border-[#2A2A2A] hover:border-[#C2A36B]/50 transition-colors duration-300 group"
                >
                  <div className="text-sm text-[#F4F4EE] font-light">{a.label}</div>
                  <div className="overline mt-0.5 group-hover:text-[#C2A36B] transition-colors duration-300">
                    {a.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
