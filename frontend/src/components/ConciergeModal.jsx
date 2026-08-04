import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api } from "@/lib/api";

const TYPES = [
  { code: "hold_table", label: "Hold a table" },
  { code: "preview_menu", label: "Preview the menu" },
  { code: "request", label: "A quiet request" },
];

export function ConciergeModal({ venue, onClose, onSent }) {
  const [type, setType] = useState("hold_table");
  const [message, setMessage] = useState("");
  const [partySize, setPartySize] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/venues/${venue.id}/concierge`, {
        request_type: type,
        message: message.trim(),
        party_size: type === "hold_table" && partySize ? parseInt(partySize, 10) : null,
        arrival_time: type === "hold_table" && arrivalTime ? arrivalTime : null,
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F0F0F]/85 backdrop-blur-sm"
      onClick={onClose}
      data-testid="concierge-modal"
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#161616] border border-[#2A2A2A] p-8 sm:p-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          data-testid="concierge-close"
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8E8E8E] hover:text-[#F4F4EE] transition-colors duration-300"
        >
          <X strokeWidth={1.2} className="h-5 w-5" />
        </button>

        <div className="overline">Concierge</div>
        <h2 className="font-serif-display text-3xl mt-2 leading-tight">
          Speak with {venue.name}.
        </h2>
        <p className="text-sm text-[#8E8E8E] font-light mt-2">
          A quiet note ahead of your arrival — held for the room.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="concierge-form">
          <div>
            <label className="overline block mb-3">What may we do</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setType(t.code)}
                  data-testid={`concierge-type-${t.code}`}
                  className={`px-3 py-3 border text-xs tracking-wider uppercase transition-colors duration-300 ${
                    type === t.code
                      ? "border-[#C2A36B] text-[#C2A36B]"
                      : "border-[#2A2A2A] text-[#8E8E8E] hover:text-[#F4F4EE]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {type === "hold_table" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="overline block mb-2">Party</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  placeholder="2"
                  data-testid="concierge-party-input"
                  className="w-full bg-transparent border-b border-[#2A2A2A] py-2 text-[#F4F4EE] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                />
              </div>
              <div>
                <label className="overline block mb-2">Arrival</label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  data-testid="concierge-arrival-input"
                  className="w-full bg-transparent border-b border-[#2A2A2A] py-2 text-[#F4F4EE] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300"
                />
              </div>
            </div>
          )}

          <div>
            <label className="overline block mb-2">Your note</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "hold_table"
                  ? "A quiet corner if possible. Celebrating an anniversary."
                  : type === "preview_menu"
                    ? "Would you send tonight's tasting menu ahead?"
                    : "Anything the room should know."
              }
              data-testid="concierge-message-input"
              className="w-full bg-transparent border border-[#2A2A2A] p-3 text-[#F4F4EE] font-light focus:border-[#C2A36B] outline-none transition-colors duration-300 resize-none placeholder:text-[#5C5C5C]"
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
              className="overline text-[#8E8E8E] hover:text-[#F4F4EE] transition-colors duration-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
