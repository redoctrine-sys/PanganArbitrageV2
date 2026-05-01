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

function estimateTransportCost(vendors: Vendor[], volumeKg: number): { cost: number; vendor_name: string | null } {
  if (vendors.length === 0) return { cost: 0, vendor_name: null };

  // Use cheapest per-km vendor. Default 200km inter-city.
  const trucks = vendors.filter((v) => v.pricing_type === "per_km");
  const candidate = trucks.length > 0 ? trucks[0] : vendors[0];

  const DEFAULT_KM = 200;
  const costPerTrip = calcTransport(candidate, DEFAULT_KM);
  const trips = candidate.capacity_kg && candidate.capacity_kg > 0
    ? Math.ceil(volumeKg / candidate.capacity_kg)
    : 1;

  return { cost: costPerTrip * trips, vendor_name: candidate.name };
}

interface RawCandidate {
  spread: number;
  spreadPct: number;
  profit: number;
  transportCost: number;
  vendor_name: string | null;
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
 */
export function findArbitrage(
  points: PricePoint[],
  vendors: Vendor[],
  volumeKg = 1000,
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
        const cheapest = sorted[i];
        const expensive = sorted[j];
        if (cheapest.kode_wilayah === expensive.kode_wilayah) continue;

        const spread = expensive.price - cheapest.price;
        const spreadPct = spread / cheapest.price;
        const { cost: transportCost, vendor_name } = estimateTransportCost(vendors, volumeKg);
        const profit = expensive.price * volumeKg - cheapest.price * volumeKg - transportCost;

        const meetsThreshold = spreadPct >= MIN_SPREAD_PERCENT && profit >= MIN_PROFIT_THRESHOLD;

        if (meetsThreshold) {
          const severity: ArbitrageOpportunity["severity"] =
            spreadPct > 0.30 ? "high" : spreadPct > 0.10 ? "medium" : "low";

          passed.push({
            type: "arbitrage",
            severity,
            commodity_id: cheapest.commodity_id,
            commodity_name: cheapest.commodity_name,
            city_from: cheapest.city_name,
            city_to: expensive.city_name,
            price_buy: cheapest.price,
            price_sell: expensive.price,
            price_spread: spread,
            spread_percent: parseFloat((spreadPct * 100).toFixed(2)),
            volume_kg: volumeKg,
            transport_cost: transportCost,
            profit_estimate: profit,
            vendor_name,
          });
        } else if (spread > 0) {
          // Candidate for fallback (best-effort)
          fallback.push({ spread, spreadPct, profit, transportCost, vendor_name, cheapest, expensive });
        }
      }
    }
  }

  // Sort passed by profit desc
  passed.sort((a, b) => b.profit_estimate - a.profit_estimate);

  // Backfill from best candidates if we don't have enough
  if (passed.length < TOP_N_FALLBACK) {
    const need = TOP_N_FALLBACK - passed.length;
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
          commodity_id: c.cheapest.commodity_id,
          commodity_name: c.cheapest.commodity_name,
          city_from: c.cheapest.city_name,
          city_to: c.expensive.city_name,
          price_buy: c.cheapest.price,
          price_sell: c.expensive.price,
          price_spread: c.spread,
          spread_percent: parseFloat((c.spreadPct * 100).toFixed(2)),
          volume_kg: volumeKg,
          transport_cost: c.transportCost,
          profit_estimate: c.profit,
          vendor_name: c.vendor_name,
        });
      });
  }

  return passed.slice(0, 30);
}
