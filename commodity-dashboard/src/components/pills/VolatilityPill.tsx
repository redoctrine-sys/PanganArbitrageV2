import { volatilityBucket } from "@/lib/analytics/metrics";

export function VolatilityPill({
  value,
  withLabel = false,
}: {
  value: number | null;
  withLabel?: boolean;
}) {
  if (value == null) return <span className="pill pill-neu">—</span>;
  const bucket = volatilityBucket(value);
  const label = bucket === "lo" ? "Rendah" : bucket === "mid" ? "Sedang" : "Tinggi";
  const cls = `pill-${bucket}`;
  return (
    <span className={`pill ${cls}`}>
      {(value / 100).toFixed(2)}
      {withLabel ? ` ${label}` : ""}
    </span>
  );
}
