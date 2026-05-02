import type { TransportOption } from "./alert-card.types";

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[10px] font-mono py-[2px] text-ink-mid">
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

export function CalcRow({ label, value, highlight, dimmed, borderTop }: {
  label: string; value: React.ReactNode;
  highlight?: boolean; dimmed?: boolean; borderTop?: boolean;
}) {
  return (
    <div className={`flex justify-between text-[10px] font-mono py-[3px] ${borderTop ? "border-t border-rule mt-[2px] pt-[5px]" : ""}`}>
      <span className={dimmed ? "text-ink-dim" : "text-ink-mid"}>{label}</span>
      <span className={`font-semibold ${highlight ? "text-up text-[11px]" : dimmed ? "text-ink-dim" : "text-ink"}`}>{value}</span>
    </div>
  );
}

export function fmtEta(hours: number, distanceKm?: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const time = h === 0 ? `~${m} Menit` : m === 0 ? `~${h} Jam` : `~${h} Jam ${m} Menit`;
  const hasFerry = distanceKm != null && hours > distanceKm / 40 + 1;
  return hasFerry ? `${time} (Darat + Feri)` : `${time} (Darat)`;
}

export function parseTransportOptions(raw: string | undefined): TransportOption[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
