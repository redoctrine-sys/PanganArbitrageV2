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

interface Props {
  stats: { cities: number; commodities: number; latestDate: string | null; aboveHet: number };
  view: View;
  onViewChange: (v: View) => void;
}

export function SP2KPHeader({ stats, view, onViewChange }: Props) {
  return (
    <div className="px-[18px] pt-3 pb-0 bg-[#f0ece4] border-b-2 border-rule shrink-0">
      <div className="flex items-center gap-[9px] mb-[9px]">
        <div className="w-1 h-[22px] rounded-[3px] bg-sp shrink-0" />
        <div>
          <div className="font-serif text-[15px] font-bold">
            SP2KP — Sistem Pemantauan Pasar &amp; Kebutuhan Pokok
          </div>
          <div className="font-mono text-[10px] text-ink-dim">
            Kemendag · Upload CSV/XLSX ad hoc · Sumber data primer · HET/HA tersedia sebagai detail
          </div>
        </div>
      </div>
      <div className="flex gap-[7px] mb-[9px]">
        <Stat label="Kab/Kota"    value={stats.cities      ? String(stats.cities)      : "—"} />
        <Stat label="Komoditas"   value={stats.commodities ? String(stats.commodities) : "—"} />
        <Stat label="Anomali HET" value={String(stats.aboveHet)} accentClass={stats.aboveHet > 0 ? "text-dn" : undefined} />
        <Stat label="Data terbaru" value={stats.latestDate ? formatDateLong(stats.latestDate) : "—"} />
      </div>
      <div className="flex gap-[3px] pb-[9px]">
        {(["city", "commodity"] as View[]).map((v) => (
          <div key={v} role="button" tabIndex={0}
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
