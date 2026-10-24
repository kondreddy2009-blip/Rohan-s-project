import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, Users, Crown, ChevronRight, ArrowRight, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  { email: "bhandariyashvee@gmail.com", label: "Owner · Admin (Insider)", password: "ritual2026", icon: Crown, accent: true },
  { email: "mila@ritual.app", label: "Mila · Inner Circle", password: "ritual2026", icon: User },
  { email: "alex@ritual.app", label: "Alex · Regular", password: "ritual2026", icon: Users },
  { email: "staff.lumen@ritual.app", label: "Staff · Lumen", password: "ritual2026", icon: Users },
];

const STAFF_DEMO_ACCOUNTS = [
  { email: "staff.lumen@ritual.app", label: "Ikigai · Staff", password: "ritual2026", icon: Store },
  { email: "staff.verre@ritual.app", label: "Verre · Staff", password: "ritual2026", icon: Store },
];

const fieldWrap =
  "flex items-center gap-3 rounded-xl border border-white/10 bg-[#1A1917] px-4 focus-within:border-[#CE6A4A]/70 transition-colors";
const fieldInput = "w-full bg-transparent py-4 text-[15px] text-white outline-none placeholder:text-[#6F6A64]";
const fieldLabel = "mb-2 block text-sm font-semibold text-white";

function PasswordInput({ value, onChange, testId, autoComplete, minLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={fieldWrap}>
      <Lock strokeWidth={1.6} className="h-5 w-5 text-[#B8B2AA] shrink-0" />
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        data-testid={testId}
        className={fieldInput}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        data-testid={`${testId}-toggle`}
        className="text-[#B8B2AA] hover:text-white transition-colors"
      >
        {visible ? <Eye size={19} /> : <EyeOff size={19} />}
      </button>
    </div>
  );
}

export default function Login({ staff = false }) {
  const { user, login, register, registerRestaurant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(location.state?.mode === "create" ? "create" : "signin"); // "signin" | "create"
  const [name, setName] = useState("");
  const [email, setEmail] = useState(staff ? "" : "bhandariyashvee@gmail.com");
  const [password, setPassword] = useState(staff ? "" : "ritual2026");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
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
    if (res.ok && staff && res.user.role !== "staff" && res.user.role !== "admin") {
      await logout();
      setBusy(false);
      setError("This account isn't linked to a restaurant. Use member sign in instead.");
      return;
    }
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

  const doRegisterRestaurant = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await registerRestaurant({
      owner_name: name,
      email,
      password,
      restaurant_name: restaurantName,
      cuisine,
      neighborhood,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Welcome to Table. Let's set up ${restaurantName}.`);
      navigate("/staff/payouts", { replace: true });
    } else {
      setError(res.error);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signin") {
      await doLogin(email, password);
    } else if (staff) {
      await doRegisterRestaurant();
    } else {
      await doRegister();
    }
  };

  return (
    <div className="min-h-screen bg-[#121110] text-[#F2EDE7] grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1560053608-13721e0d69e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHw0fHxtb29keSUyMGZpbmUlMjBkaW5pbmclMjByZXN0YXVyYW50fGVufDB8fHx8MTc4NTc3ODIxNXww&ixlib=rb-4.1.0&q=85"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-16">
          <h2 className="text-[40px] leading-tight tracking-tight">
            <span className="font-light">More than a meal,</span>
            <br />
            <span className="font-semibold">a story at every table.</span>
          </h2>
          <div className="mt-6 h-0.5 w-14 bg-[#CE6A4A]" />
          <div className="mt-5 text-xs tracking-[0.3em] text-white/70">DINE · EARN · RETURN</div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 sm:px-10 py-10">
        <div className="w-full max-w-[620px] rounded-3xl border border-white/[0.07] bg-[#121110] px-6 sm:px-10 py-9 animate-fade-up">
          <Link to="/" data-testid="login-brand-link" className="flex flex-col items-center gap-2">
            <img src="/logo.png" alt="" className="h-[76px] w-auto" />
            <img src="/wordmark.png" alt="Table" className="h-6 w-auto" />
          </Link>
          <div
            role="tablist"
            aria-label="Account type"
            className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#1A1917] p-1"
          >
            {[
              { to: "/login", label: "Diner", icon: User, active: !staff, id: "audience-diner" },
              { to: "/restaurant-login", label: "Restaurant", icon: Store, active: staff, id: "audience-restaurant" },
            ].map((t) => (
              <Link
                key={t.to}
                to={t.to}
                role="tab"
                aria-selected={t.active}
                data-testid={t.id}
                className={
                  "flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors " +
                  (t.active ? "bg-[#CE6A4A] text-[#0B0A0A]" : "text-[#B8B2AA] hover:text-white")
                }
              >
                <t.icon strokeWidth={1.8} className="h-4 w-4" />
                {t.label}
              </Link>
            ))}
          </div>
          <h1 className="mt-6 text-center text-4xl font-extrabold tracking-tight">
            {staff
              ? mode === "signin"
                ? "Restaurant sign in"
                : "Register your restaurant"
              : mode === "signin"
              ? "Welcome back"
              : "Create your account"}
          </h1>
          <p className="mt-2 mb-7 text-center text-[15px] text-[#8F8781]">
            {staff
              ? mode === "signin"
                ? "Manage bookings, loyalty and events for your venue."
                : "Create your venue's account, then add payout details to start taking deposits."
              : mode === "signin"
              ? "Sign in to continue your dining journey."
              : "Join once. Your tier follows you to every room."}
          </p>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            {staff && mode === "create" && (
              <>
                <div>
                  <label className={fieldLabel}>Restaurant name</label>
                  <div className={fieldWrap}>
                    <Store strokeWidth={1.6} className="h-5 w-5 text-[#B8B2AA] shrink-0" />
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      data-testid="register-restaurant-name-input"
                      className={fieldInput}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={fieldLabel}>Cuisine</label>
                    <div className={fieldWrap}>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="e.g. Italian"
                        value={cuisine}
                        onChange={(e) => setCuisine(e.target.value)}
                        data-testid="register-cuisine-input"
                        className={fieldInput}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>Neighbourhood</label>
                    <div className={fieldWrap}>
                      <input
                        type="text"
                        required
                        maxLength={60}
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        data-testid="register-neighborhood-input"
                        className={fieldInput}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === "create" && (
              <div>
                <label className={fieldLabel}>{staff ? "Your name" : "Name"}</label>
                <div className={fieldWrap}>
                  <User strokeWidth={1.6} className="h-5 w-5 text-[#B8B2AA] shrink-0" />
                  <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="register-name-input"
                    className={fieldInput}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className={fieldLabel}>Email</label>
              <div className={fieldWrap}>
                <Mail strokeWidth={1.6} className="h-5 w-5 text-[#B8B2AA] shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className={fieldInput}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                testId="login-password-input"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
              />
              {mode === "signin" && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => toast.info("Password reset isn't available yet.")}
                    className="text-xs font-semibold text-[#CE6A4A] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {mode === "create" && (
              <div>
                <label className={fieldLabel}>Confirm password</label>
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
                className="rounded-lg border-l-2 border-[#E8A33D] bg-[#262321] px-3 py-2 text-sm text-[#E8A33D]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit-button"
              className="flex w-full items-center justify-between rounded-xl bg-[#CE6A4A] px-6 py-4 text-[15px] font-extrabold text-[#0B0A0A] hover:bg-[#E8A06E] transition-colors disabled:opacity-60"
            >
              <span className="flex-1 text-center">
                {busy
                  ? "One moment"
                  : mode === "signin"
                  ? "Sign in"
                  : staff
                  ? "Register restaurant"
                  : "Create account"}
              </span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#B8B2AA]">
            {mode === "signin" ? (
              <>
                {staff ? "New restaurant?" : "New here?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode("create")}
                  data-testid="switch-to-create"
                  className="font-semibold text-[#CE6A4A] hover:underline"
                >
                  {staff ? "Register your restaurant" : "Create an account"}
                </button>
              </>
            ) : (
              <>
                {staff ? "Already registered?" : "Already a member?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  data-testid="switch-to-signin"
                  className="font-semibold text-[#CE6A4A] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {mode === "signin" && (

            <>
              <div className="mt-7 flex items-center gap-4 text-xs text-[#B8B2AA]">
                <span className="h-px flex-1 bg-white/10" />
                {staff ? "Or try a demo venue" : "Or continue as a demo guest"}
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="mt-5 space-y-3">
                {(staff ? STAFF_DEMO_ACCOUNTS : DEMO_ACCOUNTS).map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      doLogin(a.email, a.password);
                    }}
                    disabled={busy}
                    data-testid={`demo-login-${a.email}`}
                    className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-[#121110] px-4 py-3.5 text-left hover:border-[#CE6A4A]/50 transition-colors disabled:opacity-60"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1F1D1B]">
                      <a.icon strokeWidth={1.8} className="h-5 w-5 text-[#CE6A4A]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={"block text-[15px] font-semibold " + (a.accent ? "text-[#CE6A4A]" : "text-white")}>
                        {a.label}
                      </span>
                      <span className="block text-sm text-[#8F8781] truncate">{a.email}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-white" />
                  </button>
                ))}
              </div>
              {/* TEMP: login bypass for development — remove before shipping */}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  staff ? doLogin("staff.lumen@ritual.app", "ritual2026") : doLogin("mila@ritual.app", "ritual2026")
                }
                data-testid={staff ? "temp-bypass-staff-login" : "temp-bypass-login"}
                className="mt-5 w-full text-center text-xs text-[#8F8781] hover:text-white transition-colors disabled:opacity-50"
              >
                {staff ? "Skip login as staff (temporary)" : "Skip login (temporary)"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
