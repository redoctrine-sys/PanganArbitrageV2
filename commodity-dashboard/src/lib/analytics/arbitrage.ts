// @domain: analytics
// @feature: arbitrage-detection
// Pure functions — deterministic, no side effects, fully testable.

import { HET_ANOMALY_THRESHOLD, MIN_PROFIT_THRESHOLD, MIN_SPREAD_PERCENT } from "@/lib/constants";
import type { AnomalyAlert, ArbitrageOpportunity, PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";

// ─── Layer 1a: Anomaly Detection ─────────────────────────────────────────────

/**
 * Detect prices above HET threshold.
 * Severity:
 *   high   > HET + 20%
 *   medium > HET + 10%
 *   low    > HET + 2% (HET_ANOMALY_THRESHOLD)
 */
export function detectAnomalies(points: PricePoint[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  for (const p of points) {
    if (p.het_ha == null || p.price <= 0) continue;

    const excess = (p.price - p.het_ha) / p.het_ha;
    if (excess <= HET_ANOMALY_THRESHOLD - 1) continue; // below threshold

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

  // Sort: highest excess first
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

// ASDP tariffs per golongan kendaraan
// Ketapang-Gilimanuk (Jawa↔Bali) dan Padangbai-Lembar (Bali↔Lombok)
type Golongan = "II" | "IVB" | "VB" | "VIB";

const ASDP_KG: Record<Golongan, number> = {
  "II":   31_600,   // Motor
  "IVB":  193_200,  // Pickup / < 2000 kg
  "VB":   353_400,  // Truk Engkel / < 5000 kg
  "VIB":  572_000,  // Truk Besar / >= 5000 kg
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

function buildTransportDetail(
  vendor: Vendor,
  distanceKm: number,
  ferryFare: number,
  fromIsland: string,
  toIsland: string,
): string {
  const km  = Math.round(distanceKm);
  const gol = getGolongan(vendor);
  const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

  const lines: string[] = [];
  lines.push(`Jarak ${km} km | 1 trip (Gol ${gol})`);

  if (vendor.pricing_type === "flat_per_trip") {
    lines.push(`Flat: ${fmt(vendor.price)}`);
  } else if (vendor.base_fare_rp != null && vendor.base_km != null) {
    if (distanceKm <= vendor.base_km) {
      lines.push(`Base (≤${vendor.base_km} km): ${fmt(vendor.base_fare_rp)}`);
    } else {
      const lanjutanKm  = distanceKm - vendor.base_km;
      const lanjutanRp  = lanjutanKm * vendor.price;
      lines.push(`Base (${vendor.base_km} km): ${fmt(vendor.base_fare_rp)}`);
      lines.push(`Lanjutan (${Math.round(lanjutanKm)} km × ${fmt(vendor.price)}/km): ${fmt(lanjutanRp)}`);
    }
  } else {
    lines.push(`${fmt(vendor.price)}/km × ${km} km: ${fmt(vendor.price * distanceKm)}`);
  }

  if (ferryFare > 0) {
    const routeLabel = fromIsland !== toIsland ? `${fromIsland}↔${toIsland}` : "";
    lines.push(`Feri (${routeLabel}): ${fmt(ferryFare)}`);
  }

  const totalPerTrip = calcTransport(vendor, distanceKm) + ferryFare;
  lines.push(`Total Transport: ${fmt(totalPerTrip)}`);

  return lines.join("\n");
}

function estimateTransportCost(
  vendors: Vendor[],
  fromLat: number | null,
  fromLon: number | null,
  toLat: number | null,
  toLon: number | null,
  fromIsland: string,
  toIsland: string,
): { cost: number; vendor_name: string | null; volume_kg: number; distance_km: number; transport_detail: string } {
  const distanceKm = calculateDistanceKm(fromLat, fromLon, toLat, toLon);
  const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

  if (vendors.length === 0) {
    const gol      = "VB" as Golongan;
    const ferryFare = getFerryFare(fromIsland, toIsland, gol);
    return {
      cost: ferryFare,
      vendor_name: null,
      volume_kg: 0,
      distance_km: distanceKm,
      transport_detail: `Jarak ${Math.round(distanceKm)} km | Tidak ada vendor${ferryFare > 0 ? ` | Feri: ${fmt(ferryFare)}` : ""}`,
    };
  }

  // Collect all valid vendors — 1 full trip each (volume = vendor.capacity_kg)
  const options: { vendor: Vendor; cost: number; ferryFare: number }[] = [];
  for (const v of vendors) {
    if (!v.capacity_kg || v.capacity_kg <= 0) continue;
    const gol       = getGolongan(v);
    const ferryFare = getFerryFare(fromIsland, toIsland, gol);
    const cost      = calcTransport(v, distanceKm) + ferryFare;
    options.push({ vendor: v, cost, ferryFare });
  }

  // Fallback: no vendor has capacity_kg
  if (options.length === 0) {
    const fallback  = vendors[0];
    const gol       = getGolongan(fallback);
    const ferryFare = getFerryFare(fromIsland, toIsland, gol);
    const cost      = calcTransport(fallback, distanceKm) + ferryFare;
    return {
      cost,
      vendor_name:      fallback.name,
      volume_kg:        fallback.capacity_kg ?? 0,
      distance_km:      distanceKm,
      transport_detail: buildTransportDetail(fallback, distanceKm, ferryFare, fromIsland, toIsland),
    };
  }

  // Sort cheapest first
  options.sort((a, b) => a.cost - b.cost);

  const best = options[0];
  const top3 = options.slice(0, 3);

  // Summary lines for top-3 options
  const summaryLines = top3.map((opt, idx) =>
    `Opsi ${idx + 1} (${opt.vendor.name} - ${opt.vendor.capacity_kg}kg): ${fmt(opt.cost)}`
  );

  // Detailed breakdown for best (cheapest) option
  const detailLines = buildTransportDetail(best.vendor, distanceKm, best.ferryFare, fromIsland, toIsland);

  const transport_detail = [...summaryLines, "", detailLines].join("\n");

  return {
    cost:         best.cost,
    vendor_name:  best.vendor.name,
    volume_kg:    best.vendor.capacity_kg!,
    distance_km:  distanceKm,
    transport_detail,
  };
}

interface RawCandidate {
  spread: number;
  spreadPct: number;
  profit: number;
  transportCost: number;
  vendor_name: string | null;
  volume_kg: number;
  distance_km: number;
  transport_detail: string;
  cheapest: PricePoint;
  expensive: PricePoint;
}

/**
 * Find arbitrage opportunities across cities for the same commodity.
 *
 * Strategy (tiered):
 *   1. Collect ALL cross-city pairs per commodity
 *   2. Return pairs that pass MIN_SPREAD_PERCENT + MIN_PROFIT_THRESHOLD → "low/medium/high"
 *   3. If total results < TOP_N_FALLBACK, backfill with best remaining pairs
 *      marked as "low" severity (margin tipis, tetap dicatat)
 *
 * Volume: uses vendor.capacity_kg (1 full trip) — NOT a fixed hardcoded value.
 */
export function findArbitrage(
  points: PricePoint[],
  vendors: Vendor[],
  TOP_N_FALLBACK = 8
): ArbitrageOpportunity[] {
  const passed: ArbitrageOpportunity[] = [];
  const fallback: RawCandidate[] = [];

  // Group by commodity
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
        );
        const profit = expensive.price * volume_kg - cheapest.price * volume_kg - transportCost;

        const meetsThreshold = spreadPct >= MIN_SPREAD_PERCENT && profit >= MIN_PROFIT_THRESHOLD;

        if (meetsThreshold) {
          const severity: ArbitrageOpportunity["severity"] =
            spreadPct > 0.30 ? "high" : spreadPct > 0.10 ? "medium" : "low";

          passed.push({
            type: "arbitrage",
            severity,
            commodity_id:    cheapest.commodity_id,
            commodity_name:  cheapest.commodity_name,
            city_from:       cheapest.city_name,
            city_to:         expensive.city_name,
            price_buy:       cheapest.price,
            price_sell:      expensive.price,
            price_spread:    spread,
            spread_percent:  parseFloat((spreadPct * 100).toFixed(2)),
            volume_kg,
            transport_cost:  transportCost,
            profit_estimate: profit,
            vendor_name,
            distance_km,
            transport_detail,
          });
        } else if (spread > 0) {
          fallback.push({ spread, spreadPct, profit, transportCost, vendor_name, volume_kg, distance_km, transport_detail, cheapest, expensive });
        }
      }
    }
  }

  // Sort passed by profit desc
  passed.sort((a, b) => b.profit_estimate - a.profit_estimate);

  // Backfill from best candidates if we don't have enough
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
          commodity_id:    c.cheapest.commodity_id,
          commodity_name:  c.cheapest.commodity_name,
          city_from:       c.cheapest.city_name,
          city_to:         c.expensive.city_name,
          price_buy:       c.cheapest.price,
          price_sell:      c.expensive.price,
          price_spread:    c.spread,
          spread_percent:  parseFloat((c.spreadPct * 100).toFixed(2)),
          volume_kg:       c.volume_kg,
          transport_cost:  c.transportCost,
          profit_estimate: c.profit,
          vendor_name:     c.vendor_name,
          distance_km:     c.distance_km,
          transport_detail: c.transport_detail,
        });
      });
  }

  return passed.slice(0, 30);
}
