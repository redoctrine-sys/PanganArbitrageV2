"use client";

import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { MiniSparkline } from "@/components/pills/MiniSparkline";
import { CitySubColHeader, CitySubRow, useCitySubSelector } from "@/components/sp2kp/CitySubRow";
import { calcChangePct, calcTrend, formatRupiah } from "@/lib/analytics/metrics";
import type { SP2KPLatestRow } from "@/types/sp2kp";

interface CommodityGroup {
  commodity_id: string;
  commodity_name: string;
  category: string | null;
  unit: string | null;
  rows: SP2KPLatestRow[];
}

interface Props {
  group: CommodityGroup;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

const COLS = "28px 1fr 110px 78px 90px 38px 16px";

export function CommodityGroupRow({ group, index, isOpen, onToggle }: Props) {
  const rows = group.rows;

  const prices = rows.map((r) => r.price_latest).filter((v): v is number => v != null);
  const avgPriceLatest =
    prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;

  const changes = rows
    .map((r) => calcChangePct(r.price_latest, r.price_prev))
    .filter((v): v is number => v != null);
  const avgChange =
    changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : null;

  // Geographic spread: (max - min) / avg across cities, expressed as %.
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const spreadPct =
    minPrice != null && maxPrice != null && avgPriceLatest > 0
      ? ((maxPrice - minPrice) / avgPriceLatest) * 100
      : null;

  // National-level trend proxy: collapse per-city stats to a 4-point series.
  const avg30Mean =
    rows.reduce((s, r) => s + (r.avg_30d ?? r.price_latest), 0) / Math.max(1, rows.length);
  const min30Mean =
    rows.reduce((s, r) => s + (r.min_30d ?? r.price_prev ?? r.price_latest), 0) /
    Math.max(1, rows.length);
  const prevMean =
    rows.reduce((s, r) => s + (r.price_prev ?? r.price_latest), 0) / Math.max(1, rows.length);

  const sparkSeries = [min30Mean, avg30Mean, prevMean, avgPriceLatest];
  const trend = calcTrend([avgPriceLatest, prevMean, avg30Mean]);

  const aboveHetCities = rows.filter(
    (r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02,
  );
  const hasAnomaly = aboveHetCities.length > 0;

  const { openId, toggle } = useCitySubSelector();

  // Anomaly cities first, then by price descending (most expensive on top).
  const sortedRows = [...rows].sort((a, b) => {
    const aAnom = a.het_ha != null && a.price_latest > a.het_ha * 1.02 ? 0 : 1;
    const bAnom = b.het_ha != null && b.price_latest > b.het_ha * 1.02 ? 0 : 1;
    if (aAnom !== bAnom) return aAnom - bAnom;
    return b.price_latest - a.price_latest;
  });

  return (
    <div className={`l1-block ${isOpen ? "open" : ""} ${hasAnomaly ? "anom" : ""}`}>
      <div className="l1-row" style={{ gridTemplateColumns: COLS }} onClick={onToggle}>
        <span
          className="font-mono"
          style={{ fontSize: 10, color: "var(--ink-dim)" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <div className="l1-name" style={{ color: hasAnomaly ? "var(--dn)" : undefined }}>
            {group.commodity_name}{hasAnomaly ? " ⚠" : ""}
          </div>
          <div className={`l1-sub ${hasAnomaly ? "anom" : ""}`}>
            {group.category ?? "—"} · per {group.unit ?? "kg"} · {rows.length} kota
            {hasAnomaly ? ` · ${aboveHetCities.length} di atas HET` : ""}
          </div>
        </div>
        <div className="l1-price" style={{ color: hasAnomaly ? "var(--dn)" : "var(--sp)" }}>
          {formatRupiah(avgPriceLatest)}
        </div>
        <div><ChangePill value={avgChange} /></div>
        <div><VolatilityPill value={spreadPct} withLabel /></div>
        <div><MiniSparkline values={sparkSeries} trend={trend} /></div>
        <div className="l1-chev">▾</div>
      </div>
      {isOpen && (
        <div className="l1-exp">
          <CitySubColHeader />
          {sortedRows.map((r, i) => (
            <CitySubRow
              key={r.kode_wilayah}
              row={r}
              index={i}
              isOpen={openId === r.kode_wilayah}
              onToggle={() => toggle(r.kode_wilayah)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommodityGroupColHeader() {
  return (
    <div className="colhd" style={{ gridTemplateColumns: COLS }}>
      <span></span>
      <span>Komoditas</span>
      <span>Harga Avg</span>
      <span>Ubah</span>
      <span>Spread</span>
      <span>Trend</span>
      <span></span>
    </div>
  );
}

export type { CommodityGroup };
