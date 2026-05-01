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

  // Use cheapest truck vendor as estimate. Default jarak 200km inter-city.
  const trucks = vendors.filter((v) => v.pricing_type === "per_km");
  const candidate = trucks.length > 0 ? trucks[0] : vendors[0];

  const DEFAULT_KM = 200;
  const costPerTrip = calcTransport(candidate, DEFAULT_KM);
  const trips = candidate.capacity_kg && candidate.capacity_kg > 0
    ? Math.ceil(volumeKg / candidate.capacity_kg)
    : 1;

  return { cost: costPerTrip * trips, vendor_name: candidate.name };
}

/**
 * Find arbitrage opportunities across cities for the same commodity.
 * Only returns opportunities where:
 *   - spread > MIN_SPREAD_PERCENT (10%)
 *   - profit > MIN_PROFIT_THRESHOLD (Rp 50k)
 */
export function findArbitrage(
  points: PricePoint[],
  vendors: Vendor[],
  volumeKg = 1000
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

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

    // Sort by price ascending
    const sorted = [...rows].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const expensive = sorted[i];
      if (cheapest.kode_wilayah === expensive.kode_wilayah) continue;

      const spread = expensive.price - cheapest.price;
      const spreadPct = spread / cheapest.price;

      if (spreadPct < MIN_SPREAD_PERCENT) continue;

      const { cost: transportCost, vendor_name } = estimateTransportCost(vendors, volumeKg);
      const revenue = expensive.price * volumeKg;
      const modal = cheapest.price * volumeKg;
      const profit = revenue - modal - transportCost;

      if (profit < MIN_PROFIT_THRESHOLD) continue;

      const severity: ArbitrageOpportunity["severity"] =
        spreadPct > 0.30 ? "high" : spreadPct > 0.15 ? "medium" : "low";

      opportunities.push({
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
    }
  }

  // Sort: highest profit first
  return opportunities.sort((a, b) => b.profit_estimate - a.profit_estimate);
}
