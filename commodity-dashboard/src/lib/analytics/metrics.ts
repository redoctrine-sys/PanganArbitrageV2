export function calcChangePct(latest: number | null, prev: number | null | undefined): number | null {
  if (latest == null || prev == null || prev === 0) return null;
  return ((latest - prev) / prev) * 100;
}

export function calcVolatility(
  max: number | null,
  min: number | null,
  avg: number | null,
): number | null {
  if (max == null || min == null || !avg) return null;
  return ((max - min) / avg) * 100;
}

export function calcVsAvg(price: number | null, avg: number | null | undefined): number | null {
  if (price == null || avg == null || avg === 0) return null;
  return ((price - avg) / avg) * 100;
}

export function calcTrend(prices: number[]): "up" | "down" | "flat" {
  if (prices.length < 3) return "flat";
  const recent = prices.slice(0, 3);
  const slope = recent[0] - recent[2];
  const denom = recent[2] === 0 ? 1 : recent[2];
  if (Math.abs(slope / denom) < 0.01) return "flat";
  return slope > 0 ? "up" : "down";
}

export function formatRupiah(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function formatRupiahShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1000)}k`;
  return `Rp ${Math.round(n)}`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function volatilityBucket(vol: number | null): "lo" | "mid" | "hi" {
  if (vol == null) return "lo";
  if (vol < 5) return "lo";
  if (vol < 15) return "mid";
  return "hi";
}
