const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹12,34,567 — Indian digit grouping. */
export function formatINR(value: number): string {
  return inr.format(Math.round(value));
}

/** ₹2,478.50 — for prices and NAVs. */
export function formatPrice(value: number, withSymbol = true): string {
  return withSymbol ? inr2.format(value) : plain2.format(value);
}

/** ₹12.3 L / ₹4.56 Cr / ₹8.97 L Cr — compact lakh/crore notation used across Indian finance. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}₹${trim(abs / 1e12)} L Cr`;
  if (abs >= 1e7) return `${sign}₹${abs >= 1e9 ? Math.round(abs / 1e7).toLocaleString("en-IN") : trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)} K`;
  return `${sign}₹${Math.round(abs)}`;
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function formatPct(value: number | null | undefined, decimals = 1, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const s = value.toFixed(decimals);
  return `${signed && value > 0 ? "+" : ""}${s}%`;
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Normalise "Rs. 500", "Rs 500", "INR 500" in model output to "₹500". */
export function normaliseRupees(text: string): string {
  return text.replace(/\bRs\.?\s?(?=\d)/g, "₹").replace(/\bINR\s?(?=\d)/g, "₹");
}

export function titleCase(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
