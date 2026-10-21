import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { assetUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "recipe", label: "Recipes" },
  { key: "restaurant", label: "The room" },
];

function Lightbox({ photos, index, onClose, onIndex }) {
  const photo = photos[index];
  const prev = useCallback(() => onIndex((index - 1 + photos.length) % photos.length), [index, photos.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % photos.length), [index, photos.length, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, prev, next]);

  const nav = "absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      data-testid="photo-lightbox"
    >
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" className={cn(nav, "left-3 sm:left-6")} onClick={(e) => { e.stopPropagation(); prev(); }}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Next photo" className={cn(nav, "right-3 sm:right-6")} onClick={(e) => { e.stopPropagation(); next(); }}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <img src={assetUrl(photo.url)} alt={photo.caption || photo.category} className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain" />
        <figcaption className="mt-3 text-center text-sm text-white/80">
          {photo.caption && <span className="font-semibold">{photo.caption} · </span>}
          <span className="uppercase tracking-[0.14em] text-xs">{photo.category}</span>
          <span className="ml-3 text-white/50">{index + 1} / {photos.length}</span>
        </figcaption>
      </figure>
    </div>
  );
}

export function PhotoGallery({ photos = [], heading, card }) {
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;

  const counts = TABS.map((t) => ({ ...t, n: t.key === "all" ? photos.length : photos.filter((p) => p.category === t.key).length }));
  const visibleTabs = counts.filter((t) => t.n > 0);
  const shown = tab === "all" ? photos : photos.filter((p) => p.category === tab);

  return (
    <section className={card} data-testid="venue-gallery">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={heading}>Gallery</h2>
        {visibleTabs.length > 2 && (
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                data-testid={`gallery-tab-${t.key}`}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  tab === t.key ? "bg-[#F5F5F3] text-[#171513]" : "bg-[#2A2826] text-[#B8B2AA] hover:text-white",
                )}
              >
                {t.label} <span className="opacity-60">{t.n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo${p.caption ? `: ${p.caption}` : ""}`}
            className={cn(
              "group relative overflow-hidden rounded-xl bg-[#262422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8694A]",
              i === 0 && shown.length >= 3 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-square",
            )}
          >
            <img
              src={assetUrl(p.thumb_url || p.url)}
              alt={p.caption || p.category}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
            {p.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-left text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {p.caption}
              </span>
            )}
          </button>
        ))}
      </div>
      {open !== null && shown[open] && (
        <Lightbox photos={shown} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      )}
    </section>
  );
}
