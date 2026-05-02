// @domain: analytics
// @feature: arbitrage-detection
// Pure functions — deterministic, no side effects, fully testable.

import { HET_ANOMALY_THRESHOLD, MIN_PROFIT_THRESHOLD, MIN_SPREAD_PERCENT } from "@/lib/constants";
import type { AnomalyAlert, ArbitrageOpportunity, PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";

// ─── Layer 1a: Anomaly Detection ─────────────────────────────────────────────

export function detectAnomalies(points: PricePoint[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  for (const p of points) {
    if (p.het_ha == null || p.price <= 0) continue;

    const excess = (p.price - p.het_ha) / p.het_ha;
    if (excess <= HET_ANOMALY_THRESHOLD - 1) continue;

    const severity: AnomalyAlert["severity"] =
      excess > 0.20 ? "high" : excess > 0.10 ? "medium" : "low";

    alerts.push({
      type: "anomaly",
      severity,
      commodity_id: p.commodity_id,
      commodity_name: p.commodity_name,
      city_name: p.city_name,
      kode_wilayah: p.kode_wilayah,
      price: p.price,
      het_ha: p.het_ha,
      excess_percent: parseFloat((excess * 100).toFixed(2)),
    });
  }

  return alerts.sort((a, b) => b.excess_percent - a.excess_percent);
}

// ─── Layer 1b: Arbitrage Detection ───────────────────────────────────────────

function calcTransport(vendor: Vendor, km: number): number {
  if (vendor.pricing_type === "flat_per_trip") return vendor.price;
  if (km <= 0) return 0;
  if (vendor.base_fare_rp != null && vendor.base_km != null) {
    return km <= vendor.base_km
      ? vendor.base_fare_rp
      : vendor.base_fare_rp + (km - vendor.base_km) * vendor.price;
  }
  return km * vendor.price;
}

function calculateDistanceKm(
  lat1: number | null, lon1: number | null,
  lat2: number | null, lon2: number | null
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 200;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Golongan = "II" | "IVB" | "VB" | "VIB";

const ASDP_KG: Record<Golongan, number> = {
  "II":   31_600,
  "IVB":  193_200,
  "VB":   353_400,
  "VIB":  572_000,
};

const ASDP_PL: Record<Golongan, number> = {
  "II":   81_600,
  "IVB":  1_058_000,
  "VB":   1_996_000,
  "VIB":  3_310_000,
};

function getGolongan(vendor: Vendor): Golongan {
  const cap  = vendor.capacity_kg ?? 0;
  const name = vendor.name.toLowerCase();
  if (name.includes("motor") || cap <= 50)  return "II";
  if (cap < 2000 || name.includes("pickup") || name.includes("mpv") || name.includes("van")) return "IVB";
  if (cap < 5000) return "VB";
  return "VIB";
}

function getFerryFare(islandA: string, islandB: string, gol: Golongan): number {
  if (islandA === islandB) return 0;
  const pair = [islandA, islandB].sort().join("-");
  switch (pair) {
    case "Bali-Jawa":    return ASDP_KG[gol];
    case "Bali-Lombok":  return ASDP_PL[gol];
    case "Jawa-Lombok":  return ASDP_KG[gol] + ASDP_PL[gol];
    case "Jawa-Madura":  return 0;
    default:             return 0;
  }
}

// Per-vendor transport option stored as JSON in transport_detail column
export interface TransportOption {
  vendor_name: string;
  capacity_kg: number;
  cost: number;
  profit: number;
  roi: number;
  breakdown: string;
  eta_hours: number;
}

// Concise single-line breakdown string stored inside each TransportOption
function buildBreakdown(
  vendor: Vendor,
  distanceKm: number,
  ferryFare: number,
  fromIsland: string,
  toIsland: string,
): string {
  const km  = Math.round(distanceKm);
  const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
  const parts: string[] = [`Jarak Total: ${km} km`];

  if (vendor.pricing_type === "flat_per_trip") {
    parts.push(`Flat ${fmt(vendor.price)}`);
  } else if (vendor.base_fare_rp != null && vendor.base_km != null) {
    if (distanceKm <= vendor.base_km) {
      parts.push(`Base (${vendor.base_km} km): ${fmt(vendor.base_fare_rp)} (Tanpa lanjutan)`);
    } else {
      const lanjutanKm = Math.round(Math.max(0, distanceKm - vendor.base_km));
      const lanjutanRp = lanjutanKm * vendor.price;
      parts.push(
        `Base (${vendor.base_km} km): ${fmt(vendor.base_fare_rp)} + Lanjutan (${lanjutanKm} km × ${fmt(vendor.price)}/km): ${fmt(lanjutanRp)}`
      );
    }
  } else {
    parts.push(`${km} km × ${fmt(vendor.price)}/km = ${fmt(vendor.price * distanceKm)}`);
  }

  if (ferryFare > 0) {
    const route = fromIsland !== toIsland ? `${fromIsland}↔${toIsland}` : "";
    parts.push(`Feri${route ? ` (${route})` : ""} ${fmt(ferryFare)}`);
  }

  return parts.join(" | ");
}

function estimateTransportCost(
  vendors: Vendor[],
  fromLat: number | null,
  fromLon: number | null,
  toLat: number | null,
  toLon: number | null,
  fromIsland: string,
  toIsland: string,
  priceBuy: number,
  priceSell: number,
): { cost: number; vendor_name: string | null; volume_kg: number; distance_km: number; transport_detail: string } {
  const distanceKm = calculateDistanceKm(fromLat, fromLon, toLat, toLon);
  const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

  if (vendors.length === 0) {
    const gol       = "VB" as Golongan;
    const ferryFare = getFerryFare(fromIsland, toIsland, gol);
    const option: TransportOption = {
      vendor_name: "Tidak ada vendor",
      capacity_kg: 0,
      cost:        ferryFare,
      profit:      0,
      roi:         0,
      breakdown:   `Jarak ${Math.round(distanceKm)} km${ferryFare > 0 ? ` | Feri: ${fmt(ferryFare)}` : ""}`,
      eta_hours:   calcEta(distanceKm, fromIsland, toIsland),
    };
    return {
      cost:             ferryFare,
      vendor_name:      null,
      volume_kg:        0,
      distance_km:      distanceKm,
      transport_detail: JSON.stringify([option]),
    };
  }

  // Evaluate each valid vendor: 1 full trip (volume = capacity_kg)
  const options: TransportOption[] = [];
  for (const v of vendors) {
    if (!v.capacity_kg || v.capacity_kg <= 0) continue;
    const gol        = getGolongan(v);
    const ferryFare  = getFerryFare(fromIsland, toIsland, gol);
    const cost       = calcTransport(v, distanceKm) + ferryFare;
    const volume_kg  = v.capacity_kg;
    const profit     = (priceSell - priceBuy) * volume_kg - cost;
    const modalBeli  = priceBuy * volume_kg;
    const roi        = modalBeli > 0 ? (profit / modalBeli) * 100 : 0;
    const breakdown  = buildBreakdown(v, distanceKm, ferryFare, fromIsland, toIsland);
    const eta_hours  = calcEtaForVendor(v, distanceKm, fromIsland, toIsland);
    options.push({ vendor_name: v.name, capacity_kg: volume_kg, cost, profit, roi, breakdown, eta_hours });
  }

  // Fallback: no vendor has capacity_kg
  if (options.length === 0) {
    const fallback   = vendors[0];
    const gol        = getGolongan(fallback);
    const ferryFare  = getFerryFare(fromIsland, toIsland, gol);
    const cost       = calcTransport(fallback, distanceKm) + ferryFare;
    const volume_kg  = fallback.capacity_kg ?? 0;
    const profit     = (priceSell - priceBuy) * volume_kg - cost;
    const modalBeli  = priceBuy * volume_kg;
    const roi        = modalBeli > 0 ? (profit / modalBeli) * 100 : 0;
    const option: TransportOption = {
      vendor_name: fallback.name,
      capacity_kg: volume_kg,
      cost,
      profit,
      roi,
      breakdown: buildBreakdown(fallback, distanceKm, ferryFare, fromIsland, toIsland),
      eta_hours: calcEtaForVendor(fallback, distanceKm, fromIsland, toIsland),
    };
    return {
      cost,
      vendor_name:      fallback.name,
      volume_kg,
      distance_km:      distanceKm,
      transport_detail: JSON.stringify([option]),
    };
  }

  // Sort by ROI desc — highest return on capital first
  options.sort((a, b) => b.roi - a.roi);

  const top4 = options.slice(0, 4);
  const best = top4[0];

  return {
    cost:             best.cost,
    vendor_name:      best.vendor_name,
    volume_kg:        best.capacity_kg,
    distance_km:      distanceKm,
    transport_detail: JSON.stringify(top4),
  };
}

// ─── Logistics Risk Helpers ───────────────────────────────────────────────────

function countFerryLegs(fromIsland: string, toIsland: string): number {
  if (fromIsland === toIsland) return 0;
  const pair = [fromIsland, toIsland].sort().join("-");
  return pair === "Jawa-Lombok" ? 2 : 1;
}

function calcEta(distanceKm: number, fromIsland: string, toIsland: string): number {
  return parseFloat((distanceKm / 40 + countFerryLegs(fromIsland, toIsland) * 4).toFixed(1));
}

function getVehicleSpeedKmh(vendor: Vendor): number {
  const name = (vendor.name ?? "").toLowerCase();
  const cap  = vendor.capacity_kg ?? 0;
  if (name.includes("motor") || cap <= 50)  return 55;
  if (cap < 2000 || name.includes("pickup") || name.includes("mpv") || name.includes("van")) return 55;
  if (cap < 8000 || name.includes("engkel") || name.includes("box")) return 40;
  return 35;
}

function calcEtaForVendor(vendor: Vendor, distanceKm: number, fromIsland: string, toIsland: string): number {
  const speed = getVehicleSpeedKmh(vendor);
  return parseFloat((distanceKm / speed + countFerryLegs(fromIsland, toIsland) * 4).toFixed(1));
}

function calcVolatility(point: PricePoint): {
  pct: number | null;
  label: "Rendah" | "Sedang" | "Tinggi" | null;
} {
  if (point.avg_30d == null || point.max_30d == null || point.min_30d == null || point.avg_30d <= 0) {
    return { pct: null, label: null };
  }
  const pct = ((point.max_30d - point.min_30d) / point.avg_30d) * 100;
  const label: "Rendah" | "Sedang" | "Tinggi" = pct < 5 ? "Rendah" : pct <= 15 ? "Sedang" : "Tinggi";
  return { pct: parseFloat(pct.toFixed(1)), label };
}

function subtractDays(isoDate: string, days: number): string {
  return new Date(new Date(isoDate).getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

function fmtDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function calcSpreadAnalysis(
  cheapest: PricePoint,
  expensive: PricePoint,
  spreadPct: number,
): {
  spread_duration: string;
  spread_divergence_days: number | null;
  spread_divergence_date: string | null;
  avg_spread_pct: number | null;
} {
  // "End" of divergence window = latest data date, NOT today
  const latestDataDate = cheapest.date > expensive.date ? cheapest.date : expensive.date;

  // Spread at T-1
  let prevSpreadPct: number | null = null;
  if (cheapest.price_prev != null && expensive.price_prev != null && cheapest.price_prev > 0) {
    prevSpreadPct = (expensive.price_prev - cheapest.price_prev) / cheapest.price_prev;
  }
  const prevHadSpread = prevSpreadPct != null && prevSpreadPct >= MIN_SPREAD_PERCENT;

  // 30-day average spread between the two cities
  let avgSpread30d: number | null = null;
  if (cheapest.avg_30d != null && expensive.avg_30d != null && cheapest.avg_30d > 0) {
    avgSpread30d = (expensive.avg_30d - cheapest.avg_30d) / cheapest.avg_30d;
  }

  let spread_divergence_date: string | null;
  let spread_divergence_days: number | null;
  let spread_duration: string;
  let avg_spread_pct: number | null;

  if (prevHadSpread) {
    // Spread existed at T-1 → started BEFORE T-1. Estimate using avg_30d.
    if (avgSpread30d != null && avgSpread30d >= MIN_SPREAD_PERCENT && spreadPct > 0) {
      // avg_30d spread is diluted across 30 days. fraction = proportion of days with spread.
      // fraction ≈ avgSpread30d / spreadPct (assumes spread was ~constant during divergence).
      const fraction = Math.min(avgSpread30d / spreadPct, 1.0);
      const estimatedDays = Math.max(2, Math.round(fraction * 30));
      const startDate = subtractDays(latestDataDate, estimatedDays);
      spread_divergence_date = startDate;
      spread_divergence_days = estimatedDays;
      spread_duration = `Spread ~${estimatedDays} hari (sejak ~${fmtDateLabel(startDate)})`;
    } else {
      // Avg 30d doesn't confirm sustained spread — recent, at least 2 days
      const d = cheapest.date_prev ?? expensive.date_prev ?? subtractDays(latestDataDate, 1);
      spread_divergence_date = d;
      spread_divergence_days = 2;
      spread_duration = `Spread sejak ${fmtDateLabel(d)} (min. 2 hari)`;
    }
    // Avg spread since divergence: average of T and T-1 (actual known values, not diluted 30d avg)
    avg_spread_pct = prevSpreadPct != null
      ? parseFloat(((spreadPct + prevSpreadPct) / 2 * 100).toFixed(2))
      : parseFloat((spreadPct * 100).toFixed(2));
  } else {
    // No spread at T-1 → new divergence, started at latest data date
    spread_divergence_date = latestDataDate;
    spread_divergence_days = 1;
    spread_duration = "Spread baru muncul hari ini";
    avg_spread_pct = parseFloat((spreadPct * 100).toFixed(2));
  }

  return { spread_duration, spread_divergence_days, spread_divergence_date, avg_spread_pct };
}

// ─────────────────────────────────────────────────────────────────────────────

interface RawCandidate {
  spread: number;
  spreadPct: number;
  profit: number;
  profit_avg: number | null;
  transportCost: number;
  vendor_name: string | null;
  volume_kg: number;
  distance_km: number;
  transport_detail: string;
  eta_hours: number;
  volatility_pct: number | null;
  volatility_label: "Rendah" | "Sedang" | "Tinggi" | null;
  volatility_pct_from: number | null;
  volatility_label_from: "Rendah" | "Sedang" | "Tinggi" | null;
  spread_duration: string;
  spread_divergence_days: number | null;
  spread_divergence_date: string | null;
  avg_spread_pct: number | null;
  logistic_risk: string | null;
  cheapest: PricePoint;
  expensive: PricePoint;
}

/**
 * Find arbitrage opportunities across cities for the same commodity.
 *
 * Strategy (tiered):
 *   1. Collect ALL cross-city pairs per commodity
 *   2. Return pairs that pass MIN_SPREAD_PERCENT + MIN_PROFIT_THRESHOLD → "low/medium/high"
 *   3. If total results < TOP_N_FALLBACK, backfill with best remaining pairs (severity "low")
 *
 * Volume and vendor selection: best ROI per route, using vendor.capacity_kg (1 full trip).
 */
export function findArbitrage(
  points: PricePoint[],
  vendors: Vendor[],
  TOP_N_FALLBACK = 8
): ArbitrageOpportunity[] {
  const passed: ArbitrageOpportunity[] = [];
  const fallback: RawCandidate[] = [];

  const byCommodity = new Map<string, PricePoint[]>();
  for (const p of points) {
    if (p.price <= 0) continue;
    const list = byCommodity.get(p.commodity_id) ?? [];
    list.push(p);
    byCommodity.set(p.commodity_id, list);
  }

  for (const [, rows] of byCommodity) {
    if (rows.length < 2) continue;

    const sorted = [...rows].sort((a, b) => a.price - b.price);

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const cheapest  = sorted[i];
        const expensive = sorted[j];
        if (cheapest.kode_wilayah === expensive.kode_wilayah) continue;

        const spread    = expensive.price - cheapest.price;
        const spreadPct = spread / cheapest.price;

        const { cost: transportCost, vendor_name, volume_kg, distance_km, transport_detail } = estimateTransportCost(
          vendors,
          cheapest.latitude,  cheapest.longitude,
          expensive.latitude, expensive.longitude,
          cheapest.island,    expensive.island,
          cheapest.price,     expensive.price,
        );
        const profit = expensive.price * volume_kg - cheapest.price * volume_kg - transportCost;

        // Logistics risk metrics
        const eta_hours                                                = calcEta(distance_km, cheapest.island, expensive.island);
        const { pct: volatility_pct,      label: volatility_label }   = calcVolatility(expensive);
        const { pct: volatility_pct_from, label: volatility_label_from } = calcVolatility(cheapest);
        const { spread_duration, spread_divergence_days, spread_divergence_date, avg_spread_pct }
                                                                       = calcSpreadAnalysis(cheapest, expensive, spreadPct);
        const logistic_risk = eta_hours > 24 && (volatility_pct ?? 0) > 15
          ? "⚠ Risiko Tinggi: Perjalanan memakan waktu > 24 jam sedangkan volatilitas harga di kota tujuan sangat tinggi. Harga jual bisa anjlok sebelum barang tiba."
          : null;

        // Profit using 30d average prices (best effort)
        const priceBuyAvg  = cheapest.avg_30d ?? cheapest.price;
        const priceSellAvg = expensive.avg_30d ?? expensive.price;
        const profit_avg   = priceSellAvg * volume_kg - priceBuyAvg * volume_kg - transportCost;

        const meetsThreshold = spreadPct >= MIN_SPREAD_PERCENT && profit >= MIN_PROFIT_THRESHOLD;

        if (meetsThreshold) {
          const severity: ArbitrageOpportunity["severity"] =
            spreadPct > 0.30 ? "high" : spreadPct > 0.10 ? "medium" : "low";

          passed.push({
            type: "arbitrage",
            severity,
            commodity_id:         cheapest.commodity_id,
            commodity_name:       cheapest.commodity_name,
            city_from:            cheapest.city_name,
            city_to:              expensive.city_name,
            price_buy:            cheapest.price,
            price_sell:           expensive.price,
            price_spread:         spread,
            spread_percent:       parseFloat((spreadPct * 100).toFixed(2)),
            volume_kg,
            transport_cost:       transportCost,
            profit_estimate:      profit,
            profit_estimate_avg:  profit_avg,
            vendor_name,
            distance_km,
            transport_detail,
            eta_hours,
            volatility_pct,
            volatility_label,
            volatility_pct_from,
            volatility_label_from,
            spread_duration,
            spread_divergence_days,
            spread_divergence_date,
            avg_spread_pct,
            logistic_risk,
          });
        } else if (spread > 0) {
          fallback.push({
            spread, spreadPct, profit, profit_avg, transportCost, vendor_name, volume_kg, distance_km, transport_detail,
            eta_hours, volatility_pct, volatility_label, volatility_pct_from, volatility_label_from,
            spread_duration, spread_divergence_days, spread_divergence_date, avg_spread_pct, logistic_risk,
            cheapest, expensive,
          });
        }
      }
    }
  }

  passed.sort((a, b) => b.profit_estimate - a.profit_estimate);

  if (passed.length < TOP_N_FALLBACK) {
    const need  = TOP_N_FALLBACK - passed.length;
    const dedup = new Set(passed.map((p) => `${p.commodity_id}:${p.city_from}:${p.city_to}`));

    fallback
      .sort((a, b) => b.spreadPct - a.spreadPct)
      .slice(0, need * 3)
      .forEach((c) => {
        if (passed.length + (passed.length < TOP_N_FALLBACK ? 1 : 0) > TOP_N_FALLBACK) return;
        const key = `${c.cheapest.commodity_id}:${c.cheapest.city_name}:${c.expensive.city_name}`;
        if (dedup.has(key)) return;
        dedup.add(key);

        passed.push({
          type: "arbitrage",
          severity: "low",
          commodity_id:          c.cheapest.commodity_id,
          commodity_name:        c.cheapest.commodity_name,
          city_from:             c.cheapest.city_name,
          city_to:               c.expensive.city_name,
          price_buy:             c.cheapest.price,
          price_sell:            c.expensive.price,
          price_spread:          c.spread,
          spread_percent:        parseFloat((c.spreadPct * 100).toFixed(2)),
          volume_kg:             c.volume_kg,
          transport_cost:        c.transportCost,
          profit_estimate:       c.profit,
          profit_estimate_avg:   c.profit_avg,
          vendor_name:           c.vendor_name,
          distance_km:           c.distance_km,
          transport_detail:      c.transport_detail,
          eta_hours:             c.eta_hours,
          volatility_pct:        c.volatility_pct,
          volatility_label:      c.volatility_label,
          volatility_pct_from:   c.volatility_pct_from,
          volatility_label_from: c.volatility_label_from,
          spread_duration:       c.spread_duration,
          spread_divergence_days: c.spread_divergence_days,
          spread_divergence_date: c.spread_divergence_date,
          avg_spread_pct:        c.avg_spread_pct,
          logistic_risk:         c.logistic_risk,
        });
      });
  }

  return passed.slice(0, 30);
}
