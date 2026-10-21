import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { assetUrl } from "@/lib/api";
import { Lightbox } from "@/components/PhotoGallery";
import { cn } from "@/lib/utils";

const formatPrice = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Indian menu convention: green mark = vegetarian, red = non-vegetarian.
function VegMark({ veg }) {
  if (veg === null || veg === undefined) return null;
  const color = veg ? "#4ADE80" : "#F87171";
  return (
    <span
      className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border"
      style={{ borderColor: color }}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

// `photos` are the restaurant's menu pages (uploaded with the "menu" category); `menu` is the optional typed menu.
export function MenuSection({ menu = [], photos = [], card, heading }) {
  const sections = menu.filter((s) => s.items?.length);
  const pages = photos.filter((p) => p.category === "menu");
  const [active, setActive] = useState("all");
  const [open, setOpen] = useState(null);
  const shown = active === "all" ? sections : sections.filter((s) => s.id === active);

  return (
    <section className={card} data-testid="venue-menu">
      <h2 className={heading}>Menu</h2>

      {pages.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="menu-pages">
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open menu page ${i + 1}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-[#241C16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C9A0]"
            >
              <img
                src={assetUrl(p.thumb_url || p.url)}
                alt={p.caption || `Menu page ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-left text-xs font-semibold text-white">
                {p.caption || `Page ${i + 1}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {pages.length === 0 && sections.length === 0 && (
        <div
          className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-white/15 px-6 py-12 text-center"
          data-testid="menu-placeholder"
        >
          <UtensilsCrossed strokeWidth={1.4} className="h-8 w-8 text-[#F0D3AE]" />
          <div className="mt-3 font-bold">Menu coming soon</div>
          <p className="mt-1 max-w-xs text-sm text-[#8E8982]">Photos of this restaurant&apos;s menu will appear here.</p>
        </div>
      )}

      {open !== null && pages[open] && (
        <Lightbox photos={pages} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      )}

      {sections.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
          {[{ id: "all", name: "All" }, ...sections].map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={active === s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                active === s.id ? "bg-[#F5F5F3] text-[#130E0B]" : "bg-[#271E17] text-[#B8B2AA] hover:text-white",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className={cn("space-y-8", sections.length > 0 && "mt-6")}>
        {shown.map((sec) => (
          <div key={sec.id} data-testid={`menu-section-${sec.id}`}>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F0D3AE]">{sec.name}</h3>
            <ul className="mt-3 divide-y divide-white/[0.08]">
              {sec.items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 py-3.5">
                  <VegMark veg={it.veg} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{it.name}</div>
                    {it.description && <p className="mt-0.5 text-sm leading-relaxed text-[#8E8982]">{it.description}</p>}
                  </div>
                  {it.photo_url && (
                    <img src={assetUrl(it.photo_url)} alt={it.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="shrink-0 font-bold tabular-nums">{formatPrice(it.price)}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
