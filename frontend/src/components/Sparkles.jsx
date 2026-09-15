import { useMemo } from "react";

/**
 * A quiet burst of gold particles used behind a moment of confirmation
 * (redemption success, tier promotion). Purely decorative.
 */
export function Sparkles({ count = 22 }) {
  const dots = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + Math.random() * 0.4;
      const radius = 90 + Math.random() * 140;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.65;
      const size = 1.5 + Math.random() * 3;
      const delay = Math.random() * 400;
      const duration = 900 + Math.random() * 900;
      return { i, x, y, size, delay, duration };
    });
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      {dots.map((d) => (
        <span
          key={d.i}
          className="absolute rounded-full bg-[#CE6A4A]"
          style={{
            width: `${d.size}px`,
            height: `${d.size}px`,
            transform: `translate(${d.x}px, ${d.y}px)`,
            animation: `table-sparkle ${d.duration}ms ease-out ${d.delay}ms both`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes table-sparkle {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.3); }
          25%  { opacity: 1; }
          80%  { opacity: 0.9; }
          100% { opacity: 0; transform: translate(var(--tx, 0), var(--ty, 0)) scale(1.4); }
        }
      `}</style>
    </div>
  );
}
