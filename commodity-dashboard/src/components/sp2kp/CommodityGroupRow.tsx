"use client";

import { useState } from "react";
import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { MiniSparkline } from "@/components/pills/MiniSparkline";
import {
  CitySubColHeader,
  CitySubRow,
  useCitySubSelector,
  type CitySubSort,
  type CitySubSortKey,
  type SortDir,
} from "@/components/sp2kp/CitySubRow";
import { calcChangePct, calcTrend, calcVolatility, calcVsAvg, formatRupiah } from "@/lib/analytics/metrics";
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

  const { avgPrice: avgPriceLatest, avgChange, spreadPct } = commodityMetrics(rows);

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

  const [sort, setSort] = useState<CitySubSort>({ key: null, dir: "desc" });

  // 3-state cycle per column: inactive → desc → asc → reset to default.
  const onSort = (key: CitySubSortKey) => {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: "desc" };
    });
  };

  const sortedRows = sortCityRows(rows, sort);

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
          <CitySubColHeader sort={sort} onSort={onSort} />
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

/**
 * Sort cities under a commodity. When `sort.key` is null, fall back to the
 * default ordering: anomaly cities (above HET) first, then most expensive.
 */
function sortCityRows(rows: SP2KPLatestRow[], sort: CitySubSort): SP2KPLatestRow[] {
  const out = [...rows];
  if (sort.key == null) {
    return out.sort((a, b) => {
      const aAnom = a.het_ha != null && a.price_latest > a.het_ha * 1.02 ? 0 : 1;
      const bAnom = b.het_ha != null && b.price_latest > b.het_ha * 1.02 ? 0 : 1;
      if (aAnom !== bAnom) return aAnom - bAnom;
      return b.price_latest - a.price_latest;
    });
  }

  const sign = sort.dir === "desc" ? -1 : 1;

  // Nulls sink to the bottom regardless of direction.
  const cmpNum = (a: number | null, b: number | null) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return sign * (a - b);
  };

  return out.sort((a, b) => {
    switch (sort.key) {
      case "kota":
        return sign * a.city_raw.localeCompare(b.city_raw);
      case "harga":
        return sign * (a.price_latest - b.price_latest);
      case "ubah":
        return cmpNum(
          calcChangePct(a.price_latest, a.price_prev),
          calcChangePct(b.price_latest, b.price_prev),
        );
      case "vol":
        return cmpNum(
          calcVolatility(a.max_30d, a.min_30d, a.avg_30d),
          calcVolatility(b.max_30d, b.min_30d, b.avg_30d),
        );
      case "vsAvg":
        return cmpNum(
          calcVsAvg(a.price_latest, a.avg_30d),
          calcVsAvg(b.price_latest, b.avg_30d),
        );
      default:
        return 0;
    }
  });
}

export type CommodityGroupSortKey = "komoditas" | "hargaAvg" | "ubah" | "spread";

export interface CommodityGroupSort {
  key: CommodityGroupSortKey | null;
  dir: SortDir;
}

interface GroupColHeaderProps {
  sort: CommodityGroupSort;
  onSort: (key: CommodityGroupSortKey) => void;
}

export function CommodityGroupColHeader({ sort, onSort }: GroupColHeaderProps) {
  return (
    <div className="colhd" style={{ gridTemplateColumns: COLS }}>
      <span></span>
      <GroupSortHeader label="Komoditas" k="komoditas" sort={sort} onSort={onSort} />
      <GroupSortHeader label="Harga Avg" k="hargaAvg"  sort={sort} onSort={onSort} />
      <GroupSortHeader label="Ubah"      k="ubah"      sort={sort} onSort={onSort} />
      <GroupSortHeader label="Spread"    k="spread"    sort={sort} onSort={onSort} />
      <span>Trend</span>
      <span></span>
    </div>
  );
}

function GroupSortHeader({
  label, k, sort, onSort,
}: {
  label: string;
  k: CommodityGroupSortKey;
  sort: CommodityGroupSort;
  onSort: (key: CommodityGroupSortKey) => void;
}) {
  const active = sort.key === k;
  const arrow = !active ? "↕" : sort.dir === "desc" ? "↓" : "↑";
  return (
    <span
      className={`sh ${active ? "active" : ""}`}
      onClick={() => onSort(k)}
    >
      {label} <span style={{ fontSize: 9 }}>{arrow}</span>
    </span>
  );
}

/**
 * Per-commodity aggregate metrics used for both display and sorting.
 * Keep this colocated with the row component so a single source of truth
 * computes the numbers shown in the row.
 */
function commodityMetrics(rows: SP2KPLatestRow[]): {
  avgPrice: number;
  avgChange: number | null;
  spreadPct: number | null;
} {
  const prices = rows.map((r) => r.price_latest).filter((v): v is number => v != null);
  const avgPrice = prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;

  const changes = rows
    .map((r) => calcChangePct(r.price_latest, r.price_prev))
    .filter((v): v is number => v != null);
  const avgChange = changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : null;

  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const spreadPct =
    minPrice != null && maxPrice != null && avgPrice > 0
      ? ((maxPrice - minPrice) / avgPrice) * 100
      : null;

  return { avgPrice, avgChange, spreadPct };
}

export function sortCommodityGroups(
  groups: CommodityGroup[],
  sort: CommodityGroupSort,
): CommodityGroup[] {
  const out = [...groups];
  if (sort.key == null) {
    return out.sort((a, b) => {
      const aAnom = a.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      const bAnom = b.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      if (aAnom !== bAnom) return aAnom - bAnom;
      return a.commodity_name.localeCompare(b.commodity_name);
    });
  }

  const sign = sort.dir === "desc" ? -1 : 1;
  const cmpNum = (a: number | null, b: number | null) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return sign * (a - b);
  };

  return out.sort((a, b) => {
    if (sort.key === "komoditas") {
      return sign * a.commodity_name.localeCompare(b.commodity_name);
    }
    const ma = commodityMetrics(a.rows);
    const mb = commodityMetrics(b.rows);
    switch (sort.key) {
      case "hargaAvg": return sign * (ma.avgPrice - mb.avgPrice);
      case "ubah":     return cmpNum(ma.avgChange, mb.avgChange);
      case "spread":   return cmpNum(ma.spreadPct, mb.spreadPct);
      default:         return 0;
    }
  });
}

export type { CommodityGroup };
