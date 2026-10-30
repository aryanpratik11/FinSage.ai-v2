import { useId } from "react";

export function Sparkline({ points, className = "h-16 w-full" }: { points: [string, number][]; className?: string }) {
  const id = useId();
  if (points.length < 2) return null;
  const values = points.map(([, v]) => v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 300;
  const H = 64;
  const coords = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - min) / span) * (H - 8)]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "var(--color-brand-500)" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
