import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  { email: "bhandariyashvee@gmail.com", label: "Owner · Admin (Insider)", password: "ritual2026" },
  { email: "mila@ritual.app", label: "Mila · Inner Circle", password: "ritual2026" },
  { email: "alex@ritual.app", label: "Alex · Regular", password: "ritual2026" },
  { email: "staff.lumen@ritual.app", label: "Staff · Lumen", password: "ritual2026" },
];

function PasswordInput({ value, onChange, testId, autoComplete, minLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        data-testid={testId}
        className="w-full bg-transparent border-b border-[#4E1E32] py-2 pr-9 text-[#F4E8DA] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        data-testid={`${testId}-toggle`}
        className="absolute right-0 top-1/2 -translate-y-1/2 text-[#C2A36B]/70 hover:text-[#C2A36B] transition-colors duration-300"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signin"); // "signin" | "create"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("bhandariyashvee@gmail.com");
  const [password, setPassword] = useState("ritual2026");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && user !== false) {
    const dest = user.role === "staff" || user.role === "admin" ? "/staff" : "/discover";
    return <Navigate to={dest} replace />;
  }

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setConfirmPassword("");
  };

  const doLogin = async (em, pw) => {
    setBusy(true);
    setError("");
    const res = await login(em, pw);
    setBusy(false);
    if (res.ok) {
      toast.success(`A table awaits, ${res.user.name.split(" ")[0]}.`);
      const dest =
        res.user.role === "staff" || res.user.role === "admin"
          ? "/staff"
          : location.state?.from?.pathname || "/discover";
      navigate(dest, { replace: true });
    } else {
      setError(res.error);
    }
  };

  const doRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await register(email, password, name);
    setBusy(false);
    if (res.ok) {
      toast.success(`Welcome, ${res.user.name.split(" ")[0]}.`);
      navigate(location.state?.from?.pathname || "/discover", { replace: true });
    } else {
      setError(res.error);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signin") {
      await doLogin(email, password);
    } else {
      await doRegister();
    }
  };

  return (
    <div className="min-h-screen bg-[#1A0912] text-[#F4E8DA] grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHw0fHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A0912]/50 to-[#1A0912]/85" />
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
            Table
          </Link>
          <h1 className="font-serif-display text-4xl mt-4 mb-2">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-[#F4E8DA]/60 font-light mb-8">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("create")}
                  data-testid="switch-to-create"
                  className="text-[#C2A36B] hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already a member?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  data-testid="switch-to-signin"
                  className="text-[#C2A36B] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          <form onSubmit={submit} className="space-y-6" data-testid="login-form">
            {mode === "create" && (
              <div>
                <label className="overline block mb-3">Name</label>
                <input
                  type="text"
                  required
                  minLength={1}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="register-name-input"
                  className="w-full bg-transparent border-b border-[#4E1E32] py-2 text-[#F4E8DA] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="overline block mb-3">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="w-full bg-transparent border-b border-[#4E1E32] py-2 text-[#F4E8DA] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="overline block mb-3">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                testId="login-password-input"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
              />
            </div>

            {mode === "create" && (
              <div>
                <label className="overline block mb-3">Confirm password</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  testId="register-confirm-password-input"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            )}

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
              {busy ? "One moment" : mode === "signin" ? "Enter" : "Create account"}
            </button>
          </form>

          {mode === "signin" && (
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
                    className="w-full text-left px-4 py-3 border border-[#4E1E32] hover:border-[#C2A36B]/50 transition-colors duration-300 group"
                  >
                    <div className="text-sm text-[#F4E8DA] font-light">{a.label}</div>
                    <div className="overline mt-0.5 group-hover:text-[#C2A36B] transition-colors duration-300">
                      {a.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
