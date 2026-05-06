"use client";

import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { MiniSparkline } from "@/components/pills/MiniSparkline";
import { CommodityColHeader, CommodityRow, useCommoditySelector } from "@/components/sp2kp/CommodityRow";
import { calcChangePct, calcVolatility, calcTrend, formatRupiah } from "@/lib/analytics/metrics";
import type { SP2KPLatestRow } from "@/types/sp2kp";
import { HET_ANOMALY_THRESHOLD } from "@/lib/constants";

interface CityGroup {
  kode_wilayah: string;
  city_raw: string;
  province: string;
  island: string;
  entity_type: "kota" | "kabupaten" | "provinsi" | null;
  rows: SP2KPLatestRow[];
}

interface Props {
  group: CityGroup;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  source?: "sp2kp" | "pihps" | "facebook";
}

const COLS = "28px 1fr 110px 78px 90px 38px 16px";

export function CityRow({ group, index, isOpen, onToggle, source = "sp2kp" }: Props) {
  const rows = group.rows;
  const avgPriceLatest =
    rows.reduce((sum, r) => sum + (r.price_latest ?? 0), 0) / Math.max(1, rows.length);

  const changes = rows
    .map((r) => calcChangePct(r.price_latest, r.price_prev))
    .filter((v): v is number => v != null);
  const avgChange =
    changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : null;

  const vols = rows
    .map((r) => calcVolatility(r.max_30d, r.min_30d, r.avg_30d))
    .filter((v): v is number => v != null);
  const avgVol =
    vols.length > 0 ? vols.reduce((s, v) => s + v, 0) / vols.length : null;

  // Cheap sparkline proxy from aggregated stats per the first commodity row.
  const head = rows[0];
  const sparkSeries: number[] = head
    ? [
        head.min_30d ?? head.price_prev ?? head.price_latest,
        head.avg_30d ?? head.price_latest,
        head.price_prev ?? head.price_latest,
        head.price_latest,
      ].filter((v): v is number => typeof v === "number")
    : [];
  const trend =
    head && head.price_latest != null
      ? calcTrend([head.price_latest, head.price_prev ?? head.price_latest, head.avg_30d ?? head.price_latest])
      : "flat";

  const aboveHetCommodities = rows.filter(
    (r) => r.het_ha != null && r.price_latest != null && r.price_latest > r.het_ha * HET_ANOMALY_THRESHOLD,
  );
  const hasAnomaly = aboveHetCommodities.length > 0;

  const { openId, toggle } = useCommoditySelector();

  // Sort: anomalies first (above HET), then alphabetical.
  const sortedRows = [...rows].sort((a, b) => {
    const aAnom = a.het_ha != null && a.price_latest != null && a.price_latest > a.het_ha * HET_ANOMALY_THRESHOLD ? 0 : 1;
    const bAnom = b.het_ha != null && b.price_latest != null && b.price_latest > b.het_ha * HET_ANOMALY_THRESHOLD ? 0 : 1;
    if (aAnom !== bAnom) return aAnom - bAnom;
    return a.commodity_name.localeCompare(b.commodity_name);
  });

  return (
    <div className={`l1-block ${isOpen ? "open" : ""} ${hasAnomaly ? "anom" : ""}`}>
      <div className="l1-row" style={{ gridTemplateColumns: COLS }} onClick={onToggle}>
        <span className="font-mono text-[10px] text-ink-dim">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <div className={`l1-name ${hasAnomaly ? "text-dn" : ""}`}>
            {group.city_raw}{hasAnomaly ? " ⚠" : ""}
          </div>
          {group.entity_type === "provinsi" ? (
            <div className="l1-sub flex items-center gap-1.5">
              <span className="text-[10px] text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded font-mono leading-none">
                Harga Agregat Provinsi
              </span>
              <span>{rows.length} komoditas · klik untuk filter</span>
            </div>
          ) : (
            <div className={`l1-sub ${hasAnomaly ? "anom" : ""}`}>
              {group.province} · {group.island} · {rows.length} komoditas
              {hasAnomaly
                ? ` · ${aboveHetCommodities.length} di atas HET`
                : ""}
            </div>
          )}
        </div>
        <div className={`l1-price ${hasAnomaly ? "text-dn" : "text-sp"}`}>
          {formatRupiah(avgPriceLatest)}
        </div>
        <div><ChangePill value={avgChange} /></div>
        <div><VolatilityPill value={avgVol} withLabel /></div>
        <div><MiniSparkline values={sparkSeries} trend={trend} /></div>
        <div className="l1-chev">{group.entity_type === "provinsi" ? "→" : "▾"}</div>
      </div>
      {isOpen && (
        <div className="l1-exp">
          <CommodityColHeader />
          {sortedRows.map((r, i) => {
            const comKey = r.commodity_id ?? r.commodity_name;
            return (
              <CommodityRow
                key={comKey}
                row={r}
                index={i}
                isOpen={openId === comKey}
                onToggle={() => toggle(comKey)}
                source={source}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CityColHeader({ label = "Kota" }: { label?: string }) {
  return (
    <div className="colhd" style={{ gridTemplateColumns: COLS }}>
      <span></span>
      <span>{label}</span>
      <span>Harga Avg</span>
      <span>Ubah</span>
      <span>Volatilitas</span>
      <span>Trend</span>
      <span></span>
    </div>
  );
}

export type { CityGroup };
