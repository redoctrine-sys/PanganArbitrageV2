"use client";

import { useState } from "react";
import { fmtRp, fmtPct } from "./arbitrase.types";

const arbSecLabel = "text-[9px] font-bold uppercase tracking-[0.9px] text-ink-dim font-mono mb-[6px]";

function ArbPriceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[11px] font-mono py-[2px] text-ink-mid">
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

const COMM_CHIPS = ["Semua", "Cabai Rawit", "Bawang Merah"];
const ROUTE_CHIPS = ["Jawa only", "Lintas Pulau"];

const demoCards = [
  {
    rank: "⭐", commodity: "Cabai Rawit Merah", signal: "BELI" as const,
    roi: 54.6, from: "Yogyakarta", to: "Denpasar",
    routeDesc: "Jawa → Bali · darat + ferry · ~8.5 jam", jarak: "312 km + 60 km ferry",
    hargaBeli: 44500, hargaJual: 72000, volume: 1000,
    transport: [
      { label: "Truk (312 km × Rp 1.200)", cost: 374400 },
      { label: "Kapal Feri flat", cost: 2500000 },
    ],
    netProfit: 24625600,
    pills: ["✓ Viable", "Risiko SEDANG", "HET+31%"],
    pillStyles: ["ok", "mid", "het"],
    reasoning: "Tren divergen 7 hari. Harga Yogyakarta stabil, Denpasar masih naik. Timing: 2–3 hari. Risk: volatilitas Denpasar 0.88.",
  },
  {
    rank: "02", commodity: "Bawang Merah", signal: "BELI" as const,
    roi: 18.4, from: "Yogyakarta", to: "Jakarta Sel.",
    routeDesc: "Jawa darat · ~7 jam · 560 km", jarak: "560 km",
    hargaBeli: 28000, hargaJual: 33500, volume: 500,
    transport: [{ label: "Truk (560 km × Rp 1.200)", cost: 672000 }],
    netProfit: 2078000,
    pills: ["✓ Viable", "Risiko RENDAH"],
    pillStyles: ["ok", "lo"],
    reasoning: "Spread konsisten 3 minggu. Rute darat stabil. Kapan saja.",
  },
];

const signalCls: Record<string, string> = {
  BELI:    "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
  TUNGGU:  "bg-[#fef3c7] text-[#78350f] border border-[#fde68a]",
  HINDARI: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
};

export function AISubtab() {
  const [commFilter, setCommFilter] = useState("Semua");
  const [routeFilter, setRouteFilter] = useState<string | null>(null);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="fbar">
        <span className="font-mono text-[10px] font-semibold text-ink-dim">KOMODITAS</span>
        {COMM_CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => setCommFilter(c)}
            className={`fbtn${commFilter === c ? " on" : ""}`}>{c}</button>
        ))}
        <div className="w-px h-[14px] bg-rule mx-1" />
        {ROUTE_CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => setRouteFilter(routeFilter === c ? null : c)}
            className={`fbtn${routeFilter === c ? " on" : ""}`}>{c}</button>
        ))}
        <div className="ml-auto flex gap-[6px] items-center">
          <span className="font-mono text-[10px] text-ink-dim">Sort:</span>
          <button type="button" className="btn btn-arb text-[10px] px-[9px] py-[3px]">
            ROI Tertinggi ▾
          </button>
        </div>
      </div>

      {/* Phase 2 notice */}
      <div className="mx-[18px] mt-[10px] px-[13px] py-[9px] bg-[#ffedd5] border border-[#fed7aa] rounded-lg flex items-center gap-[9px] text-[11px] text-arb shrink-0">
        <span>🤖</span>
        <div>
          <b>Data demo</b> — Di Phase 2, peluang ini akan ter-generate otomatis dari{" "}
          <span className="font-mono text-[10px]">komparasi_harga VIEW</span>{" "}
          (SP2KP × Pedagang) dan vendor transport DB.
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-[14px_18px] flex flex-col gap-[9px]">
        {demoCards.map((card, idx) => (
          <div key={idx} className={`bg-white border rounded-lg overflow-hidden ${idx === 0 ? "border-sp" : "border-rule"}`}>
            {/* Card head */}
            <div className="flex items-center gap-[9px] px-[13px] py-[10px] bg-paper-2 border-b border-rule">
              <span className={`font-mono text-[10px] ${idx === 0 ? "text-[#78350f]" : "text-ink-mid"}`}>{card.rank}</span>
              <div className="font-serif text-[13px] font-bold flex-1">{card.commodity}</div>
              <span className={`px-[9px] py-[3px] rounded-[5px] text-[10px] font-bold font-mono ${signalCls[card.signal]}`}>
                🤖 {card.signal}
              </span>
              <div className="text-right ml-auto">
                <div className={`font-mono text-[14px] font-bold ${card.roi > 30 ? "text-sp" : "text-ped"}`}>
                  ROI {fmtPct(card.roi)}
                </div>
                <div className="font-mono text-[9px] text-ink-dim">net setelah logistik</div>
              </div>
            </div>

            {/* Card body 3-col */}
            <div className="grid grid-cols-3 border-b border-rule">
              <div className="p-[9px_13px] border-r border-rule">
                <div className={arbSecLabel}>Rute</div>
                <div className="flex items-center gap-[6px] text-[12px] font-medium mb-1">
                  <span className="font-serif font-semibold">{card.from}</span>
                  <span className="text-ink-dim text-[10px]">──→</span>
                  <span className="font-serif font-semibold">{card.to}</span>
                </div>
                <div className="font-mono text-[9px] text-ink-dim mb-[5px]">{card.routeDesc}</div>
                <ArbPriceRow label="Jarak" value={card.jarak} />
              </div>

              <div className="p-[9px_13px] border-r border-rule">
                <div className={arbSecLabel}>Kalkulasi ({card.volume.toLocaleString("id-ID")} kg)</div>
                <ArbPriceRow label="Harga beli" value={<span className="text-up">{fmtRp(card.hargaBeli)}/kg</span>} />
                <ArbPriceRow label="Harga jual" value={<span className="text-dn">{fmtRp(card.hargaJual)}/kg</span>} />
                <ArbPriceRow label="Modal beli" value={fmtRp(card.hargaBeli * card.volume)} />
                {card.transport.map((t, i) => <ArbPriceRow key={i} label={t.label} value={fmtRp(t.cost)} />)}
              </div>

              <div className="p-[9px_13px]">
                <div className={arbSecLabel}>Hasil Bersih</div>
                <div className="mb-[7px]">
                  <div className="font-mono text-[10px] text-ink-dim mb-[2px]">Net Profit</div>
                  <div className="font-mono text-[18px] font-bold text-up">{fmtRp(card.netProfit)}</div>
                </div>
                <div className="flex gap-[5px] flex-wrap">
                  {card.pills.map((p, i) => (
                    <span key={i} className={`pill pill-${card.pillStyles[i]} text-[9px]`}>{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer reasoning */}
            <div className="px-[13px] py-[8px] bg-[#fafaf8] text-[11px] text-ink-mid leading-[1.5] flex gap-[7px]">
              <span>🤖</span>
              <span><b>{card.signal}</b> — {card.reasoning}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
