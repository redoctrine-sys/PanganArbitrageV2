"use client";

import { formatRupiah, formatPct } from "@/lib/analytics/metrics";
import type { ArbitraseCalcResult } from "../types/arbitrase";

interface Props {
  result: ArbitraseCalcResult;
}

export function ArbitraseResult({ result }: Props) {
  const color = result.isProfitable ? "var(--up)" : "var(--dn)";
  const bg = result.isProfitable ? "var(--up-bg)" : "var(--dn-bg)";
  const pillClass = result.isProfitable ? "pill-up" : "pill-dn";

  return (
    <div
      style={{
        border: `2px solid ${result.isProfitable ? "#bbf7d0" : "#fecaca"}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Summary header */}
      <div style={{ background: bg, padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{result.isProfitable ? "✓" : "✗"}</span>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 700, color }}>
              {result.isProfitable ? "Arbitrase Menguntungkan" : "Tidak Menguntungkan"}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
              {result.commodityName} · {result.sourceCity} → {result.destCity}
            </div>
          </div>
          <span className={`pill ${pillClass}`} style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px" }}>
            {formatPct(result.marginPct)} margin
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
        <StatCard
          label="Total Keuntungan"
          value={formatRupiah(result.totalProfit)}
          accent={color}
          sub={`${result.volumeKg.toLocaleString("id-ID")} kg`}
        />
        <StatCard
          label="Per kg"
          value={formatRupiah(result.netProfitPerUnit)}
          accent={color}
          sub="net profit/kg"
        />
        <StatCard
          label="Margin"
          value={formatPct(result.marginPct)}
          accent={color}
          sub="profit / modal"
        />
        <StatCard
          label="ROI"
          value={formatPct(result.roiPct)}
          accent={color}
          sub="return on invest"
        />
      </div>
    </div>
  );
}

function StatCard({
  label, value, accent, sub,
}: {
  label: string; value: string; accent: string; sub: string;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRight: "1px solid var(--rule)",
        background: "var(--paper)",
      }}
    >
      <div className="sc-l">{label}</div>
      <div className="sc-v" style={{ color: accent, fontSize: 16 }}>{value}</div>
      <div className="sc-s" style={{ marginTop: 2 }}>{sub}</div>
    </div>
  );
}
