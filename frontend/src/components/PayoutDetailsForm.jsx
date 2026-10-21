import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Clock, CircleCheck, Info } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const BUSINESS_TYPES = [
  { k: "proprietorship", l: "Proprietorship" },
  { k: "partnership", l: "Partnership" },
  { k: "llp", l: "LLP" },
  { k: "private_limited", l: "Private Limited" },
  { k: "public_limited", l: "Public Limited" },
  { k: "other", l: "Other" },
];

const STATUS_COPY = {
  not_submitted: {
    icon: Info,
    tone: "text-[color:var(--st-soft)]",
    title: "Payout details not added yet",
    body: "Add your business and bank details so Table can pay out booking deposits to you.",
  },
  submitted: {
    icon: Clock,
    tone: "text-[#E8A33D]",
    title: "Submitted — awaiting verification",
    body: "Our team will verify your details and activate payouts. You don't need to do anything else.",
  },
  active: {
    icon: CircleCheck,
    tone: "text-[#4ADE80]",
    title: "Payouts active",
    body: "Booking deposits are paid out to your bank account.",
  },
};

const EMPTY = {
  legal_name: "",
  business_type: "proprietorship",
  pan: "",
  gstin: "",
  account_holder: "",
  account_number: "",
  confirm_account_number: "",
  ifsc: "",
  bank_name: "",
  upi_id: "",
  contact_email: "",
  contact_phone: "",
};

const input =
  "mt-2 w-full rounded-xl border border-[color:var(--st-dep-fieldborder)] bg-[color:var(--st-dep-field)] px-5 py-4 text-base outline-none focus:border-[color:var(--st-gold)] transition-colors";
const label = "block text-sm font-semibold tracking-[0.15em] uppercase text-[color:var(--st-text)]";
const hint = "mt-2 text-sm text-[color:var(--st-muted)]";

function Field({ id, title, note, children }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {note && <p className={hint}>{note}</p>}
    </div>
  );
}

export function PayoutDetailsForm({ venueId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [payout, setPayout] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/staff/venues/${venueId}/payout`);
    setPayout(data);
    setLinkValue(data.razorpay_account_id || "");
    setForm({
      ...EMPTY,
      legal_name: data.legal_name || "",
      business_type: data.business_type || "proprietorship",
      gstin: data.gstin || "",
      account_holder: data.account_holder || "",
      ifsc: data.ifsc || "",
      bank_name: data.bank_name || "",
      upi_id: data.upi_id || "",
      contact_email: data.contact_email || "",
      contact_phone: data.contact_phone || "",
    });
  }, [venueId]);

  useEffect(() => {
    setPayout(null);
    load().catch(() => toast.error("Could not load payout details."));
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const saved = payout && payout.status !== "not_submitted";

  const save = async (e) => {
    e.preventDefault();
    if (form.account_number !== form.confirm_account_number) {
      toast.error("Account numbers do not match.");
      return;
    }
    setBusy(true);
    try {
      const { confirm_account_number, ...rest } = form;
      const body = {
        ...rest,
        pan: rest.pan.trim() || null,
        account_number: rest.account_number.trim() || null,
        gstin: rest.gstin.trim() || null,
        upi_id: rest.upi_id.trim() || null,
      };
      const { data } = await api.put(`/staff/venues/${venueId}/payout`, body);
      setPayout(data);
      setForm((f) => ({ ...f, pan: "", account_number: "", confirm_account_number: "" }));
      toast.success("Payout details saved.");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not save payout details.");
    } finally {
      setBusy(false);
    }
  };

  const saveLink = async () => {
    setLinkBusy(true);
    try {
      const { data } = await api.patch(`/staff/venues/${venueId}/payout/razorpay-account`, {
        razorpay_account_id: linkValue.trim(),
      });
      setPayout(data);
      toast.success(data.razorpay_account_id ? "Razorpay account linked." : "Razorpay account unlinked.");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not update the link.");
    } finally {
      setLinkBusy(false);
    }
  };

  if (!payout) {
    return <div className="text-[color:var(--st-muted)]" data-testid="payout-loading">Loading…</div>;
  }

  const status = STATUS_COPY[payout.status] || STATUS_COPY.submitted;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-8 animate-fade-up" data-testid="payout-tab">
      <div
        className="flex items-start gap-4 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6"
        data-testid="payout-status"
      >
        <StatusIcon strokeWidth={1.6} className={cn("h-7 w-7 shrink-0", status.tone)} />
        <div>
          <div className="text-lg font-semibold">{status.title}</div>
          <p className="mt-1 text-[color:var(--st-soft)]">{status.body}</p>
          {saved && (
            <p className="mt-3 text-sm text-[color:var(--st-muted)]">
              PAN ending {payout.pan_last4} · Account ending {payout.account_last4}
              {payout.razorpay_account_id ? ` · ${payout.razorpay_account_id}` : ""}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={save}
        className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6 sm:p-8 space-y-8"
        data-testid="payout-form"
      >
        <div className="flex items-center gap-4">
          <Landmark strokeWidth={1.5} className="h-6 w-6 text-[color:var(--st-gold)]" />
          <div className="overline text-[color:var(--st-text)]">Business &amp; bank details</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field id="legal_name" title="Legal business name">
            <input id="legal_name" required maxLength={120} value={form.legal_name} onChange={set("legal_name")} data-testid="payout-legal-name" className={input} />
          </Field>
          <Field id="business_type" title="Business type">
            <select id="business_type" value={form.business_type} onChange={set("business_type")} data-testid="payout-business-type" className={input}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.k} value={t.k}>{t.l}</option>
              ))}
            </select>
          </Field>
          <Field id="pan" title="PAN" note={saved ? "Leave blank to keep the PAN on file." : "10 characters, e.g. ABCDE1234F."}>
            <input
              id="pan"
              required={!saved}
              maxLength={10}
              pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
              placeholder={saved ? `•••••• ${payout.pan_last4}` : ""}
              value={form.pan}
              onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
              data-testid="payout-pan"
              autoComplete="off"
              className={input}
            />
          </Field>
          <Field id="gstin" title="GSTIN (optional)">
            <input
              id="gstin"
              maxLength={15}
              pattern="[0-9A-Za-z]{15}"
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              data-testid="payout-gstin"
              className={input}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field id="account_holder" title="Account holder name">
            <input id="account_holder" required maxLength={120} value={form.account_holder} onChange={set("account_holder")} data-testid="payout-account-holder" className={input} />
          </Field>
          <Field id="bank_name" title="Bank name">
            <input id="bank_name" required maxLength={80} value={form.bank_name} onChange={set("bank_name")} data-testid="payout-bank-name" className={input} />
          </Field>
          <Field id="account_number" title="Account number" note={saved ? "Leave blank to keep the account on file." : undefined}>
            <input
              id="account_number"
              required={!saved}
              inputMode="numeric"
              pattern="[0-9]{9,18}"
              maxLength={18}
              placeholder={saved ? `•••••••• ${payout.account_last4}` : ""}
              value={form.account_number}
              onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value.replace(/\D/g, "") }))}
              data-testid="payout-account-number"
              autoComplete="off"
              className={input}
            />
          </Field>
          <Field id="confirm_account_number" title="Confirm account number">
            <input
              id="confirm_account_number"
              required={!saved || !!form.account_number}
              inputMode="numeric"
              maxLength={18}
              value={form.confirm_account_number}
              onChange={(e) => setForm((f) => ({ ...f, confirm_account_number: e.target.value.replace(/\D/g, "") }))}
              data-testid="payout-confirm-account-number"
              autoComplete="off"
              className={input}
            />
          </Field>
          <Field id="ifsc" title="IFSC code">
            <input
              id="ifsc"
              required
              maxLength={11}
              pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
              value={form.ifsc}
              onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
              data-testid="payout-ifsc"
              className={input}
            />
          </Field>
          <Field id="upi_id" title="UPI ID (optional)">
            <input id="upi_id" maxLength={80} value={form.upi_id} onChange={set("upi_id")} data-testid="payout-upi" className={input} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field id="contact_email" title="Finance contact email">
            <input id="contact_email" type="email" required value={form.contact_email} onChange={set("contact_email")} data-testid="payout-contact-email" className={input} />
          </Field>
          <Field id="contact_phone" title="Finance contact phone">
            <input
              id="contact_phone"
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value.replace(/\D/g, "") }))}
              data-testid="payout-contact-phone"
              className={input}
            />
          </Field>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="flex items-center gap-2 text-sm text-[color:var(--st-muted)]">
            <ShieldCheck strokeWidth={1.5} className="h-5 w-5 shrink-0 text-[color:var(--st-gold)]" />
            PAN and account numbers are encrypted and never shown in full again.
          </p>
          <button
            type="submit"
            disabled={busy}
            data-testid="payout-save"
            className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-10 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition"
          >
            {busy ? "Saving" : saved ? "Update details" : "Submit details"}
          </button>
        </div>
      </form>

      {isAdmin && (
        <div
          className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-card)] p-6 sm:p-8"
          data-testid="payout-admin-link"
        >
          <div className="overline text-[color:var(--st-text)]">Admin · Razorpay linked account</div>
          <p className={hint}>
            Paste the venue's Razorpay linked account ID (acc_…) once it is created. Leave empty to unlink.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="acc_XXXXXXXXXXXXXX"
              disabled={!saved}
              data-testid="payout-razorpay-account-input"
              className={cn(input, "mt-0 sm:max-w-md")}
            />
            <button
              type="button"
              onClick={saveLink}
              disabled={linkBusy || !saved}
              data-testid="payout-razorpay-account-save"
              className="rounded-xl border border-[color:var(--st-gold)] px-8 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase text-[color:var(--st-gold)] hover:bg-[color:var(--st-gold)] hover:text-[#1A1308] disabled:opacity-50 transition"
            >
              {linkBusy ? "Saving" : "Save link"}
            </button>
          </div>
          {!saved && <p className={hint}>This venue hasn't submitted payout details yet.</p>}
        </div>
      )}
    </div>
  );
}
