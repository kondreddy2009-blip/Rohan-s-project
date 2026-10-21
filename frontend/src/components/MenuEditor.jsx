import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const input =
  "w-full rounded-lg border border-[color:var(--st-border)] bg-[color:var(--st-card)] px-3 py-2.5 text-sm text-[color:var(--st-text)] outline-none focus:border-[color:var(--st-gold)] transition-colors placeholder:text-[color:var(--st-faint)]";

const blankItem = () => ({ key: crypto.randomUUID(), name: "", description: "", price: "", veg: null });
const blankSection = () => ({ key: crypto.randomUUID(), name: "", items: [blankItem()] });

const fromVenue = (menu) =>
  (menu || []).map((s) => ({
    key: s.id,
    name: s.name,
    items: s.items.map((i) => ({ key: i.id, name: i.name, description: i.description || "", price: String(i.price), veg: i.veg ?? null, photo_url: i.photo_url || null })),
  }));

const VEG_CYCLE = [null, true, false];
const VEG_LABEL = { null: "Veg?", true: "Veg", false: "Non-veg" };

export function MenuEditor({ venue, onSaved }) {
  const [sections, setSections] = useState(() => fromVenue(venue.menu));
  const [busy, setBusy] = useState(false);

  const updateSection = (key, patch) => setSections((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const updateItem = (skey, ikey, patch) =>
    setSections((ss) => ss.map((s) => (s.key === skey ? { ...s, items: s.items.map((i) => (i.key === ikey ? { ...i, ...patch } : i)) } : s)));

  const save = async () => {
    const cleaned = sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.name.trim()) }))
      .filter((s) => s.name.trim() || s.items.length);
    if (cleaned.some((s) => !s.name.trim())) return toast.error("Give every section a name.");
    if (cleaned.some((s) => s.items.some((i) => i.price === "" || Number(i.price) < 0 || Number.isNaN(Number(i.price))))) {
      return toast.error("Every dish needs a price.");
    }
    setBusy(true);
    try {
      await api.put(`/staff/venues/${venue.id}/menu`, {
        sections: cleaned.map((s) => ({
          name: s.name.trim(),
          items: s.items.map((i) => ({ name: i.name.trim(), description: i.description.trim(), price: Number(i.price), veg: i.veg, photo_url: i.photo_url || null })),
        })),
      });
      toast.success("Menu saved.");
      onSaved?.();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-14 max-w-3xl" data-testid="menu-editor">
      <h3 className="font-serif text-2xl text-[color:var(--st-text)]">Menu</h3>
      <p className="mt-1 text-sm text-[color:var(--st-muted)]">Sections and dishes shown on your restaurant page. Prices are in ₹.</p>

      <div className="mt-5 space-y-6">
        {sections.map((s) => (
          <div key={s.key} className="rounded-2xl border border-[color:var(--st-border)] p-4 sm:p-5" data-testid="menu-editor-section">
            <div className="flex items-center gap-2">
              <input className={cn(input, "font-semibold")} value={s.name} placeholder="Section name, e.g. Starters" maxLength={60} onChange={(e) => updateSection(s.key, { name: e.target.value })} />
              <button type="button" aria-label="Remove section" onClick={() => setSections((ss) => ss.filter((x) => x.key !== s.key))} className="p-2 text-[color:var(--st-muted)] hover:text-[#F87171]">
                <Trash2 strokeWidth={1.6} className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {s.items.map((i) => (
                <div key={i.key} className="grid grid-cols-[1fr_6rem_auto_auto] items-start gap-2">
                  <div className="space-y-2">
                    <input className={input} value={i.name} placeholder="Dish name" maxLength={80} onChange={(e) => updateItem(s.key, i.key, { name: e.target.value })} />
                    <input className={input} value={i.description} placeholder="Short description (optional)" maxLength={240} onChange={(e) => updateItem(s.key, i.key, { description: e.target.value })} />
                  </div>
                  <input className={input} value={i.price} inputMode="decimal" placeholder="₹ Price" onChange={(e) => updateItem(s.key, i.key, { price: e.target.value })} />
                  <button
                    type="button"
                    onClick={() => updateItem(s.key, i.key, { veg: VEG_CYCLE[(VEG_CYCLE.indexOf(i.veg) + 1) % 3] })}
                    className={cn("rounded-lg border px-2.5 py-2.5 text-xs font-semibold whitespace-nowrap", i.veg === true ? "border-[#4ADE80] text-[#4ADE80]" : i.veg === false ? "border-[#F87171] text-[#F87171]" : "border-[color:var(--st-border)] text-[color:var(--st-muted)]")}
                  >
                    {VEG_LABEL[i.veg]}
                  </button>
                  <button type="button" aria-label="Remove dish" onClick={() => updateSection(s.key, { items: s.items.filter((x) => x.key !== i.key) })} className="p-2.5 text-[color:var(--st-muted)] hover:text-[#F87171]">
                    <Trash2 strokeWidth={1.6} className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => updateSection(s.key, { items: [...s.items, blankItem()] })} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--st-gold)] hover:brightness-110">
              <Plus className="h-4 w-4" /> Add dish
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setSections((ss) => [...ss, blankSection()])} data-testid="menu-add-section" className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--st-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--st-text)] hover:border-[color:var(--st-gold)] transition-colors">
          <Plus className="h-4 w-4" /> Add section
        </button>
        <button type="button" disabled={busy} onClick={save} data-testid="menu-save-button" className="rounded-xl bg-gradient-to-r from-[#D9B06A] to-[#B8904F] px-8 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#1A1308] hover:brightness-110 disabled:opacity-50 transition">
          {busy ? "Saving" : "Save menu"}
        </button>
      </div>
    </div>
  );
}
