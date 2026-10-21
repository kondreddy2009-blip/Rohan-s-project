import { cn } from "@/lib/utils";

// Stacked lockup: emblem, TABLE wordmark, then tagline — all centered.
export function BrandLockup({ className, size = "md", tone = "gold" }) {
  const sfx = tone === "orange" ? "-orange" : "";
  const s =
    size === "lg"
      ? { emblem: "h-24", word: "w-52", tag: "w-60", gap: "gap-3" }
      : { emblem: "h-10", word: "w-24", tag: "w-[110px]", gap: "gap-1.5" };
  return (
    <div className={cn("inline-flex flex-col items-center", s.gap, className)}>
      <img src={`/logo${sfx}.png`} alt="" className={cn(s.emblem, "w-auto")} />
      <img src={`/wordmark${sfx}.png`} alt="Table" className={cn(s.word, "h-auto")} />
      <img src={`/tagline${sfx}.png`} alt="Dine · Earn · Return" className={cn(s.tag, "h-auto")} />
    </div>
  );
}
