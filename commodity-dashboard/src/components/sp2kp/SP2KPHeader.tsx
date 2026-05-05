"use client";

import { formatDateLong } from "@/lib/utils/date";

export type View = "city" | "commodity";

function Stat({ label, value, accentClass }: { label: string; value: string; accentClass?: string }) {
  return (
    <div className="sc">
      <div className="sc-l">{label}</div>
      <div className={`sc-v${accentClass ? " " + accentClass : ""}`}>{value}</div>
    </div>
  );
}

export interface SourceConfig {
  title: string;
  subtitle: string;
  accentClass: string;        // Tailwind class for accent bar (e.g. "bg-sp")
  cityLabel?: string;         // "Kab/Kota" (default) or custom
  showAnomalyStat?: boolean;  // PIHPS has no HET → hide anomaly stat
}

const DEFAULT_CONFIG: SourceConfig = {
  title: "SP2KP — Sistem Pemantauan Pasar & Kebutuhan Pokok",
  subtitle:
    "Kemendag · Upload CSV/XLSX ad hoc · Sumber data primer · HET/HA tersedia sebagai detail",
  accentClass: "bg-sp",
  showAnomalyStat: true,
};

interface Props {
  stats: { cities: number; commodities: number; latestDate: string | null; aboveHet: number };
  view: View;
  onViewChange: (v: View) => void;
  config?: SourceConfig;
}

export function SP2KPHeader({ stats, view, onViewChange, config = DEFAULT_CONFIG }: Props) {
  return (
    <div className="px-[18px] pt-3 pb-0 bg-[#f0ece4] border-b-2 border-rule shrink-0">
      <div className="flex items-center gap-[9px] mb-[9px]">
        <div className={`w-1 h-[22px] rounded-[3px] ${config.accentClass} shrink-0`} />
        <div>
          <div className="font-serif text-[15px] font-bold">{config.title}</div>
          <div className="font-mono text-[10px] text-ink-dim">{config.subtitle}</div>
        </div>
      </div>
      <div className="flex gap-[7px] mb-[9px]">
        <Stat label={config.cityLabel ?? "Kab/Kota"} value={stats.cities ? String(stats.cities) : "—"} />
        <Stat label="Komoditas" value={stats.commodities ? String(stats.commodities) : "—"} />
        {config.showAnomalyStat !== false && (
          <Stat
            label="Anomali HET"
            value={String(stats.aboveHet)}
            accentClass={stats.aboveHet > 0 ? "text-dn" : undefined}
          />
        )}
        <Stat label="Data terbaru" value={stats.latestDate ? formatDateLong(stats.latestDate) : "—"} />
      </div>
      <div className="flex gap-[3px] pb-[9px]">
        {(["city", "commodity"] as View[]).map((v) => (
          <div
            key={v}
            role="button"
            tabIndex={0}
            className={`stab${view === v ? " active" : ""}`}
            onClick={() => onViewChange(v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewChange(v); }}
          >
            {v === "city" ? "📍 By City" : "🌾 By Commodity"}
          </div>
        ))}
      </div>
    </div>
  );
}
