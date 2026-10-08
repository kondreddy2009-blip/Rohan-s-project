import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { formatApiError } from "@/lib/api";
import { useIsAdmin } from "@/lib/auth-context";
import {
  AVAILABILITY_OPTIONS,
  PRICE_BANDS,
  partnerImage,
  partnersService,
  slugify,
  usePartnerMutations,
  usePartners,
} from "@/lib/partnersService";
import { TIER_ORDER, tierLabel } from "@/lib/tiers";
import { cn } from "@/lib/utils";

// --- Provider: lets any page (tab strip, Profile, restaurant page) open the form ---
const PartnerFormContext = createContext({ openPartnerForm: () => {} });

export function usePartnerForm() {
  return useContext(PartnerFormContext);
}

export function PartnerFormProvider({ children }) {
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const openPartnerForm = useCallback((partner = null) => setEditing(partner), []);
  const value = useMemo(() => ({ openPartnerForm }), [openPartnerForm]);
  return (
    <PartnerFormContext.Provider value={value}>
      {children}
      {isAdmin && editing !== undefined && (
        <PartnerFormModal partner={editing} onClose={() => setEditing(undefined)} />
      )}
    </PartnerFormContext.Provider>
  );
}

// --- Form helpers ---
const MAX_PHOTO_EDGE = 1600;
let rowKey = 0;
const nextKey = () => `row-${++rowKey}`;

function toForm(p) {
  if (!p) {
    return {
      name: "",
      area: "",
      cuisine: "",
      address: "",
      distance_km: "",
      hours: "",
      image_url: "",
      availability: "seat_now",
      waitlist_minutes: "",
      walk_in: true,
      double_points_tonight: false,
      chefs_pick: false,
      points_per_visit: "",
      price_band: 2,
      most_reordered: [],
      events: [],
    };
  }
  return {
    name: p.name,
    area: p.area,
    cuisine: p.cuisine,
    address: p.address || "",
    distance_km: p.distance_km ?? "",
    hours: p.hours || "",
    image_url: p.image_url,
    availability: p.availability || "seat_now",
    waitlist_minutes: p.waitlist_minutes ?? "",
    walk_in: !!p.walk_in,
    double_points_tonight: !!p.double_points_tonight,
    chefs_pick: !!p.chefs_pick,
    points_per_visit: p.points_per_visit ?? "",
    price_band: p.price_band || 2,
    most_reordered: p.most_reordered || [],
    events: (p.events || []).map((e) => ({
      key: nextKey(),
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      seats: e.seats ?? "",
      tier_required: e.tier_required || "",
    })),
  };
}

function validate(form, partners, editingId) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Name is required.";
  else {
    const slug = slugify(name);
    const clash = partners.find(
      (p) => p.id !== editingId && (p.name.toLowerCase() === name.toLowerCase() || p.slug === slug),
    );
    if (clash) errors.name = `${clash.name} is already on Table.`;
  }
  if (!form.area.trim()) errors.area = "Area is required.";
  if (!form.cuisine.trim()) errors.cuisine = "Cuisine is required.";
  if (!form.image_url) errors.image_url = "Add a photo.";
  else if (!/^(https?:\/\/\S+|\/api\/uploads\/\S+)$/.test(form.image_url)) {
    errors.image_url = "Use an http(s) link.";
  }
  const points = Number(form.points_per_visit);
  if (form.points_per_visit === "" || !Number.isInteger(points) || points < 1) {
    errors.points_per_visit = "Points per visit must be a whole number of at least 1.";
  }
  if (form.distance_km !== "" && !(Number(form.distance_km) >= 0)) {
    errors.distance_km = "Distance must be a positive number.";
  }
  if (form.availability === "waitlist" && form.waitlist_minutes !== "") {
    const m = Number(form.waitlist_minutes);
    if (!Number.isInteger(m) || m < 1 || m > 240) errors.waitlist_minutes = "Enter 1–240 minutes.";
  }
  form.events.forEach((e) => {
    if (!e.title.trim()) errors[`${e.key}.title`] = "Title is required.";
    if (!e.date) errors[`${e.key}.date`] = "Pick a date.";
    if (!e.time) errors[`${e.key}.time`] = "Pick a time.";
    const seats = Number(e.seats);
    if (e.seats === "" || !Number.isInteger(seats) || seats < 1) errors[`${e.key}.seats`] = "Seats must be at least 1.";
  });
  return errors;
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    area: form.area.trim(),
    cuisine: form.cuisine.trim(),
    address: form.address.trim(),
    distance_km: form.distance_km === "" ? null : Number(form.distance_km),
    ...(form.hours.trim() && { hours: form.hours.trim() }),
    image_url: form.image_url,
    availability: form.availability,
    waitlist_minutes:
      form.availability === "waitlist" && form.waitlist_minutes !== "" ? Number(form.waitlist_minutes) : null,
    walk_in: form.walk_in,
    double_points_tonight: form.double_points_tonight,
    chefs_pick: form.chefs_pick,
    points_per_visit: Number(form.points_per_visit),
    price_band: form.price_band,
    most_reordered: form.most_reordered,
    events: form.events.map((e) => ({
      ...(e.id && { id: e.id }),
      title: e.title.trim(),
      date: e.date,
      time: e.time,
      seats: Number(e.seats),
      tier_required: e.tier_required || null,
    })),
  };
}

/** Map a FastAPI 422 body onto field keys used by the form. */
function serverErrors(detail, form) {
  if (!Array.isArray(detail)) return { _form: formatApiError(detail) };
  const out = {};
  detail.forEach((d) => {
    const [, field, index, sub] = d.loc || [];
    const msg = (d.msg || "Invalid value").replace(/^Value error, /, "");
    if (field === "events" && form.events[index]) out[`${form.events[index].key}.${sub}`] = msg;
    else if (field) out[field] = msg;
    else out._form = msg;
  });
  return out;
}

function downscale(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

// --- Small form pieces ---
function Field({ id, label, error, hint, children, className }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="tbl-label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] text-ritual-faint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="tbl-error">
          {error}
        </p>
      )}
    </div>
  );
}

function inputProps(id, error) {
  return {
    id,
    className: "tbl-input",
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

function Group({ title, children }) {
  const id = `pf-group-${title.toLowerCase()}`;
  return (
    <section role="group" aria-labelledby={id} className="pt-7 first:pt-0">
      <h3 id={id} className="tbl-eyebrow mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("tbl-pill tbl-pill--lg", value === o.value ? "tbl-pill--light" : "tbl-pill--filled")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn("tbl-pill tbl-pill--lg", checked ? "tbl-pill--tint" : "tbl-pill--filled")}
    >
      <span
        aria-hidden="true"
        className={cn("tbl-dot", checked ? "bg-ritual-accent" : "bg-ritual-faint")}
      />
      {label}
    </button>
  );
}

// --- Modal ---
export function PartnerFormModal({ partner, onClose }) {
  const navigate = useNavigate();
  const { data: partners = [] } = usePartners();
  const { create, update } = usePartnerMutations();
  const [form, setForm] = useState(() => toForm(partner));
  const [errors, setErrors] = useState({});
  const [photoMode, setPhotoMode] = useState(
    partner && !partner.image_url?.startsWith("/api/uploads/") ? "url" : "upload",
  );
  const [photoPreview, setPhotoPreview] = useState(partner ? partnerImage(partner.image_url) : "");
  const [uploading, setUploading] = useState(false);
  const [menuDraft, setMenuDraft] = useState("");
  const formRef = useRef(null);
  const editing = !!partner;
  const saving = create.isPending || update.isPending;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const setEvent = (key, field, value) => {
    setForm((f) => ({ ...f, events: f.events.map((e) => (e.key === key ? { ...e, [field]: value } : e)) }));
    setErrors((e) => ({ ...e, [`${key}.${field}`]: undefined }));
  };

  const onPhotoFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, image_url: "Choose an image file." }));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await downscale(file);
      setPhotoPreview(dataUrl);
      const url = await partnersService.uploadPhoto(dataUrl);
      set("image_url", url);
    } catch (err) {
      setPhotoPreview("");
      set("image_url", "");
      setErrors((e) => ({
        ...e,
        image_url: err.response ? formatApiError(err.response.data?.detail) : err.message,
      }));
    } finally {
      setUploading(false);
    }
  };

  const addMenuItem = () => {
    const item = menuDraft.trim();
    if (item && !form.most_reordered.some((m) => m.toLowerCase() === item.toLowerCase())) {
      set("most_reordered", [...form.most_reordered, item]);
    }
    setMenuDraft("");
  };

  const focusFirstError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

  const onSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    const found = validate(form, partners, partner?.id);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      focusFirstError();
      return;
    }
    const payload = toPayload(form);
    try {
      const saved = editing
        ? await update.mutateAsync({ id: partner.id, payload })
        : await create.mutateAsync(payload);
      toast.success(editing ? `${saved.name} updated` : `${saved.name} added to Table`);
      onClose();
      navigate(`/restaurant/${saved.slug}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      setErrors(status === 409 ? { name: formatApiError(detail) } : serverErrors(detail, form));
      focusFirstError();
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !saving && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="tbl-overlay" />
        <Dialog.Content className="tbl-modal" aria-describedby={undefined} data-testid="partner-form-modal">
          <div className="flex items-center justify-between gap-4 px-6 py-4 tbl-rule">
            <Dialog.Title className="tbl-h2 text-[19px]">
              {editing ? `Edit ${partner.name}` : "Add partner"}
            </Dialog.Title>
            <Dialog.Close className="tbl-pill tbl-pill--filled h-8 w-8 p-0" aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </Dialog.Close>
          </div>

          <form ref={formRef} onSubmit={onSubmit} noValidate className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2">
              <Group title="Basics">
                <div className="grid grid-cols-1 desk:grid-cols-2 gap-4">
                  <Field id="pf-name" label="Name *" error={errors.name} className="desk:col-span-2">
                    <input {...inputProps("pf-name", errors.name)} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bombay Canteen" autoComplete="off" />
                  </Field>
                  <Field id="pf-area" label="Area *" error={errors.area}>
                    <input {...inputProps("pf-area", errors.area)} value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Kala Ghoda" />
                  </Field>
                  <Field id="pf-cuisine" label="Cuisine *" error={errors.cuisine}>
                    <input {...inputProps("pf-cuisine", errors.cuisine)} value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="Modern Indian" />
                  </Field>
                  <Field id="pf-address" label="Address" error={errors.address} className="desk:col-span-2">
                    <input {...inputProps("pf-address", errors.address)} value={form.address} onChange={(e) => set("address", e.target.value)} />
                  </Field>
                  <Field id="pf-distance" label="Distance (km)" error={errors.distance_km}>
                    <input {...inputProps("pf-distance", errors.distance_km)} type="number" min="0" step="0.1" inputMode="decimal" value={form.distance_km} onChange={(e) => set("distance_km", e.target.value)} />
                  </Field>
                  <Field id="pf-hours" label="Hours" error={errors.hours} hint="Used for booking slots, e.g. 18:00 – 23:30">
                    <input {...inputProps("pf-hours", errors.hours)} value={form.hours} onChange={(e) => set("hours", e.target.value)} placeholder="18:00 – 23:30" />
                  </Field>
                </div>
              </Group>

              <Group title="Photo">
                <Segmented
                  label="Photo source"
                  value={photoMode}
                  onChange={setPhotoMode}
                  options={[
                    { value: "upload", label: "Upload" },
                    { value: "url", label: "Link" },
                  ]}
                />
                <div className="mt-4 grid grid-cols-1 desk:grid-cols-[1fr_180px] gap-4 items-start">
                  {photoMode === "upload" ? (
                    <Field id="pf-photo-file" label="Photo *" error={errors.image_url} hint="JPEG, PNG or WebP. Large photos are resized.">
                      <input
                        {...inputProps("pf-photo-file", errors.image_url)}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => onPhotoFile(e.target.files?.[0])}
                        className="tbl-input file:mr-3 file:rounded-full file:border-0 file:bg-ritual-surface file:px-3 file:py-1 file:text-ritual-text file:font-semibold"
                      />
                    </Field>
                  ) : (
                    <Field id="pf-photo-url" label="Photo link *" error={errors.image_url}>
                      <input
                        {...inputProps("pf-photo-url", errors.image_url)}
                        type="url"
                        value={form.image_url.startsWith("/api/") ? "" : form.image_url}
                        onChange={(e) => {
                          set("image_url", e.target.value.trim());
                          setPhotoPreview(e.target.value.trim());
                        }}
                        placeholder="https://…"
                      />
                    </Field>
                  )}
                  <div className="relative h-[110px] rounded-xl overflow-hidden bg-ritual-surface-2 flex items-center justify-center text-[12px] text-ritual-faint">
                    {uploading ? (
                      "Uploading…"
                    ) : photoPreview ? (
                      <img src={photoPreview} alt="Photo preview" className="tbl-media" />
                    ) : (
                      "No photo yet"
                    )}
                  </div>
                </div>
              </Group>

              <Group title="Tonight">
                <Segmented
                  label="Status"
                  value={form.availability}
                  onChange={(v) => set("availability", v)}
                  options={AVAILABILITY_OPTIONS}
                />
                {form.availability === "waitlist" && (
                  <Field id="pf-wait" label="Waitlist (minutes)" error={errors.waitlist_minutes} className="mt-4 max-w-[200px]">
                    <input {...inputProps("pf-wait", errors.waitlist_minutes)} type="number" min="1" max="240" inputMode="numeric" value={form.waitlist_minutes} onChange={(e) => set("waitlist_minutes", e.target.value)} placeholder="15" />
                  </Field>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Toggle label="Walk-ins welcome" checked={form.walk_in} onChange={(v) => set("walk_in", v)} />
                  <Toggle label="2× points tonight" checked={form.double_points_tonight} onChange={(v) => set("double_points_tonight", v)} />
                  <Toggle label="Chef's pick" checked={form.chefs_pick} onChange={(v) => set("chefs_pick", v)} />
                </div>
              </Group>

              <Group title="Rewards">
                <div className="grid grid-cols-1 desk:grid-cols-[180px_1fr] gap-4 items-start">
                  <Field id="pf-points" label="Points per visit *" error={errors.points_per_visit}>
                    <input {...inputProps("pf-points", errors.points_per_visit)} type="number" min="1" inputMode="numeric" value={form.points_per_visit} onChange={(e) => set("points_per_visit", e.target.value)} placeholder="10" />
                  </Field>
                  <div>
                    <span className="tbl-label">Price band</span>
                    <Segmented label="Price band" value={form.price_band} onChange={(v) => set("price_band", v)} options={PRICE_BANDS} />
                  </div>
                </div>
              </Group>

              <Group title="Menu">
                <label htmlFor="pf-menu" className="tbl-label">
                  Most re-ordered
                </label>
                {form.most_reordered.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-2" aria-label="Most re-ordered items">
                    {form.most_reordered.map((item) => (
                      <li key={item} className="tbl-pill tbl-pill--filled pr-1.5">
                        {item}
                        <button
                          type="button"
                          onClick={() => set("most_reordered", form.most_reordered.filter((m) => m !== item))}
                          className="rounded-full p-0.5 text-ritual-muted hover:text-ritual-text"
                          aria-label={`Remove ${item}`}
                        >
                          <X className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    id="pf-menu"
                    className="tbl-input"
                    value={menuDraft}
                    onChange={(e) => setMenuDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMenuItem();
                      }
                    }}
                    placeholder="Kejriwal toast"
                  />
                  <button type="button" onClick={addMenuItem} className="tbl-pill tbl-pill--filled tbl-pill--lg">
                    Add
                  </button>
                </div>
              </Group>

              <Group title="Events">
                <div className="space-y-4">
                  {form.events.map((ev, i) => (
                    <div key={ev.key} className="rounded-2xl bg-ritual-surface-2 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-bold">Event {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => set("events", form.events.filter((x) => x.key !== ev.key))}
                          className="tbl-pill tbl-pill--ghost"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 desk:grid-cols-4 gap-3">
                        <Field id={`${ev.key}-title`} label="Title" error={errors[`${ev.key}.title`]} className="col-span-2 desk:col-span-4">
                          <input {...inputProps(`${ev.key}-title`, errors[`${ev.key}.title`])} value={ev.title} onChange={(e) => setEvent(ev.key, "title", e.target.value)} />
                        </Field>
                        <Field id={`${ev.key}-date`} label="Date" error={errors[`${ev.key}.date`]}>
                          <input {...inputProps(`${ev.key}-date`, errors[`${ev.key}.date`])} type="date" value={ev.date} onChange={(e) => setEvent(ev.key, "date", e.target.value)} />
                        </Field>
                        <Field id={`${ev.key}-time`} label="Time" error={errors[`${ev.key}.time`]}>
                          <input {...inputProps(`${ev.key}-time`, errors[`${ev.key}.time`])} type="time" value={ev.time} onChange={(e) => setEvent(ev.key, "time", e.target.value)} />
                        </Field>
                        <Field id={`${ev.key}-seats`} label="Seats" error={errors[`${ev.key}.seats`]}>
                          <input {...inputProps(`${ev.key}-seats`, errors[`${ev.key}.seats`])} type="number" min="1" inputMode="numeric" value={ev.seats} onChange={(e) => setEvent(ev.key, "seats", e.target.value)} />
                        </Field>
                        <Field id={`${ev.key}-tier`} label="Minimum tier">
                          <select {...inputProps(`${ev.key}-tier`)} value={ev.tier_required} onChange={(e) => setEvent(ev.key, "tier_required", e.target.value)}>
                            <option value="">Open to all</option>
                            {TIER_ORDER.slice(1).map((t) => (
                              <option key={t} value={t}>
                                {tierLabel(t)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      set("events", [
                        ...form.events,
                        { key: nextKey(), title: "", date: "", time: "20:00", seats: "", tier_required: "" },
                      ])
                    }
                    className="tbl-pill tbl-pill--filled tbl-pill--lg"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Add event
                  </button>
                </div>
              </Group>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-ritual-border">
              <p className="tbl-error mt-0" role="alert">
                {errors._form || ""}
              </p>
              <div className="flex items-center gap-2">
                <Dialog.Close type="button" className="tbl-pill tbl-pill--filled tbl-pill--lg" disabled={saving}>
                  Cancel
                </Dialog.Close>
                <button type="submit" className="tbl-pill tbl-pill--accent tbl-pill--lg" disabled={saving || uploading} data-testid="partner-form-save">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add partner"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
