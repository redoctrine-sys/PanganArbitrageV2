import { formatPct } from "@/lib/analytics/metrics";

export function ChangePill({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="pill pill-neu">—</span>;
  const positive = value > 0;
  const negative = value < 0;
  const cls = positive ? (invert ? "pill-dn" : "pill-up") : negative ? (invert ? "pill-up" : "pill-dn") : "pill-neu";
  const arrow = positive ? "▲" : negative ? "▼" : "=";
  return <span className={`pill ${cls}`}>{arrow}{formatPct(value)}</span>;
}
