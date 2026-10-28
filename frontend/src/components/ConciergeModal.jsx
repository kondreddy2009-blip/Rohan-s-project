import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/lib/api";

const TYPES = [
  { code: "preview_menu", label: "Preview the menu" },
  { code: "request", label: "A quiet request" },
];

export function ConciergeModal({ venue, onClose, onSent }) {
  const [type, setType] = useState("preview_menu");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/venues/${venue.id}/concierge`, {
        request_type: type,
        message: message.trim(),
      });
      toast.success(`Your note has been sent to ${venue.name}.`);
      onSent?.();
      onClose?.();
    } catch (e2) {
      toast.error(e2.response?.data?.detail || "Could not send just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0B0A0A]/85 backdrop-blur-sm"
      onClick={onClose}
      data-testid="concierge-modal"
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#1B1917] border border-[#262321] p-8 sm:p-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          data-testid="concierge-close"
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-300"
        >
          <X strokeWidth={1.2} className="h-5 w-5" />
        </button>

        <div className="overline">Concierge</div>
        <h2 className="font-serif-display text-3xl mt-2 leading-tight">
          Speak with {venue.name}.
        </h2>
        <p className="text-sm text-[#8F8781] font-light mt-2">
          A question for the room. To hold a table, use Reserve a table.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="concierge-form">
          <div>
            <label className="overline block mb-3">What may we do</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setType(t.code)}
                  data-testid={`concierge-type-${t.code}`}
                  className={`px-3 py-3 border text-xs tracking-wider uppercase transition-colors duration-300 ${
                    type === t.code
                      ? "border-[#CE6A4A] text-[#CE6A4A]"
                      : "border-[#262321] text-[#8F8781] hover:text-[#F2EDE7]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="overline block mb-2">Your note</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "preview_menu"
                  ? "Would you send tonight's tasting menu ahead?"
                  : "Anything the room should know."
              }
              data-testid="concierge-message-input"
              className="w-full bg-transparent border border-[#262321] p-3 text-[#F2EDE7] font-light focus:border-[#CE6A4A] outline-none transition-colors duration-300 resize-none placeholder:text-[#6B6560]"
            />
          </div>

          <div className="pt-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || !message.trim()}
              data-testid="concierge-submit"
              className="btn-primary"
            >
              {busy ? "Sending" : "Send to the room"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="overline text-[#8F8781] hover:text-[#F2EDE7] transition-colors duration-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
