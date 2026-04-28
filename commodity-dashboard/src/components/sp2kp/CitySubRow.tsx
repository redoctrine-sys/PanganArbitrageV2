"use client";

import { useState } from "react";
import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { ChartPanel } from "@/components/sp2kp/ChartPanel";
import { calcChangePct, calcVolatility, calcVsAvg, formatPct, formatRupiah } from "@/lib/analytics/metrics";
import type { SP2KPLatestRow } from "@/types/sp2kp";

/* ── City sub-row inside a Commodity group (By Commodity view) ── */

interface Props {
  row: SP2KPLatestRow;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

const COLS = "32px 1fr 95px 78px 80px 82px 16px";

export function CitySubRow({ row, index, isOpen, onToggle }: Props) {
  const change = calcChangePct(row.price_latest, row.price_prev);
  const volatility = calcVolatility(row.max_30d, row.min_30d, row.avg_30d);
  const vsAvg = calcVsAvg(row.price_latest, row.avg_30d);
  const aboveHet = row.het_ha != null && row.price_latest > row.het_ha * 1.02;

  return (
    <div className={`l2-block ${isOpen ? "open" : ""} ${aboveHet ? "anom" : ""}`}>
      <div className="l2-row" style={{ gridTemplateColumns: COLS }} onClick={onToggle}>
        <span
          className="font-mono"
          style={{ fontSize: 9, color: "var(--ink-dim)", paddingLeft: 12 }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <div className="l2-name" style={{ color: aboveHet ? "var(--dn)" : undefined }}>
            {row.city_raw}{aboveHet ? " ⚠" : ""}
          </div>
          <div className="l2-sub">
            {row.province} · {row.island}
            {aboveHet && row.het_ha
              ? ` · Di atas HET ${formatPct(((row.price_latest - row.het_ha) / row.het_ha) * 100)}`
              : ""}
          </div>
        </div>
        <div className="l2-price" style={{ color: aboveHet ? "var(--dn)" : "var(--up)" }}>
          {formatRupiah(row.price_latest)}
        </div>
        <div><ChangePill value={change} /></div>
        <div><VolatilityPill value={volatility} /></div>
        <div>
          {vsAvg == null ? (
            <span className="pill pill-neu">—</span>
          ) : (
            <span className={`pill ${vsAvg < 0 ? "pill-up" : "pill-dn"}`}>
              {vsAvg > 0 ? "▲" : "▼"}{formatPct(vsAvg)}
            </span>
          )}
        </div>
        <div className="l2-chev">▾</div>
      </div>
      <div className="l2-exp">
        {aboveHet && row.het_ha && (
          <div className="anom-bar danger">
            ⚠ <span>
              <b>Di atas HET {formatPct(((row.price_latest - row.het_ha) / row.het_ha) * 100)}</b> —{" "}
              {formatRupiah(row.price_latest)} vs HET {formatRupiah(row.het_ha)}.
            </span>
          </div>
        )}
        {isOpen && <ChartPanel row={row} />}
      </div>
    </div>
  );
}

export function CitySubColHeader() {
  return (
    <div className="l2-colhd" style={{ gridTemplateColumns: COLS }}>
      <span></span>
      <span>Kota</span>
      <span>Harga</span>
      <span>Ubah</span>
      <span>Vol</span>
      <span>vs Avg</span>
      <span></span>
    </div>
  );
}

export function useCitySubSelector() {
  const [openId, setOpenId] = useState<string | null>(null);
  return {
    openId,
    toggle: (id: string) => setOpenId((cur) => (cur === id ? null : id)),
  };
}
