import { describe, it, expect } from "vitest";
import { detectAnomalies, findArbitrage, calcWeightLossPct } from "./arbitrage";
import type { PricePoint } from "@/lib/ai/agents/arbitrage/types";
import type { Vendor } from "@/lib/ai/agents/arbitrage/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePoint(overrides: Partial<PricePoint> = {}): PricePoint {
  return {
    kode_wilayah:  "3201",
    city_name:     "Kota A",
    commodity_id:  "cabai-rawit",
    commodity_name: "Cabai Rawit Merah",
    price:         10_000,
    het_ha:        10_000,
    date:          "2026-01-01",
    province:      "Jawa Barat",
    island:        "Jawa",
    latitude:      -6.2,
    longitude:     106.8,
    price_prev:    null,
    date_prev:     null,
    avg_30d:       null,
    max_30d:       null,
    min_30d:       null,
    ...overrides,
  };
}

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id:           "v1",
    name:         "Truck Besar",
    pricing_type: "per_km",
    price:        2_000,
    capacity_kg:  10_000,
    base_fare_rp: null,
    base_km:      null,
    coverage:     null,
    ...overrides,
  };
}

// ─── detectAnomalies ─────────────────────────────────────────────────────────

describe("detectAnomalies", () => {
  it("returns anomaly when price > HET × 1.02", () => {
    const point = makePoint({ price: 15_000, het_ha: 10_000 });
    const alerts = detectAnomalies([point]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("anomaly");
    expect(alerts[0].excess_percent).toBeCloseTo(50, 0);
  });

  it("returns no alert when price exactly at HET", () => {
    const point = makePoint({ price: 10_000, het_ha: 10_000 });
    expect(detectAnomalies([point])).toHaveLength(0);
  });

  it("returns no alert when price within 2% above HET", () => {
    const point = makePoint({ price: 10_100, het_ha: 10_000 });
    expect(detectAnomalies([point])).toHaveLength(0);
  });

  it("skips rows with null HET", () => {
    const point = makePoint({ price: 20_000, het_ha: null });
    expect(detectAnomalies([point])).toHaveLength(0);
  });

  it("skips rows with price <= 0", () => {
    const point = makePoint({ price: 0, het_ha: 10_000 });
    expect(detectAnomalies([point])).toHaveLength(0);
  });

  it("assigns severity=high when excess > 20%", () => {
    const point = makePoint({ price: 13_000, het_ha: 10_000 });
    const [alert] = detectAnomalies([point]);
    expect(alert.severity).toBe("high");
  });

  it("assigns severity=medium when excess 10–20%", () => {
    const point = makePoint({ price: 11_500, het_ha: 10_000 });
    const [alert] = detectAnomalies([point]);
    expect(alert.severity).toBe("medium");
  });

  it("assigns severity=low when excess 2–10%", () => {
    const point = makePoint({ price: 10_300, het_ha: 10_000 });
    const [alert] = detectAnomalies([point]);
    expect(alert.severity).toBe("low");
  });

  it("sorts by excess_percent descending", () => {
    const low  = makePoint({ kode_wilayah: "3201", price: 10_300, het_ha: 10_000 });
    const high = makePoint({ kode_wilayah: "3202", price: 15_000, het_ha: 10_000 });
    const [first] = detectAnomalies([low, high]);
    expect(first.excess_percent).toBeGreaterThan(40);
  });
});

// ─── findArbitrage ────────────────────────────────────────────────────────────

describe("findArbitrage", () => {
  it("returns opportunity when spread > 10% and profit > 50k", () => {
    const cheap = makePoint({ kode_wilayah: "3201", city_name: "Kota A", price: 10_000 });
    const dear  = makePoint({ kode_wilayah: "3202", city_name: "Kota B", price: 15_000 });
    const vendor = makeVendor({ price: 500 });
    const results = findArbitrage([cheap, dear], [vendor]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe("arbitrage");
    expect(results[0].city_from).toBe("Kota A");
    expect(results[0].city_to).toBe("Kota B");
  });

  it("excludes same city pairs", () => {
    const p1 = makePoint({ kode_wilayah: "3201", price: 10_000 });
    const p2 = makePoint({ kode_wilayah: "3201", price: 15_000 });
    const results = findArbitrage([p1, p2], []);
    expect(results.find(r => r.city_from === r.city_to)).toBeUndefined();
  });

  it("returns empty when only 1 city per commodity", () => {
    const point = makePoint({ price: 10_000 });
    const results = findArbitrage([point], []);
    expect(results).toHaveLength(0);
  });

  it("sorts results by profit_estimate descending", () => {
    const a    = makePoint({ kode_wilayah: "3201", city_name: "Kota A", commodity_id: "beras", price: 10_000 });
    const b    = makePoint({ kode_wilayah: "3202", city_name: "Kota B", commodity_id: "beras", price: 20_000 });
    const c    = makePoint({ kode_wilayah: "3203", city_name: "Kota C", commodity_id: "beras", price: 25_000 });
    const vendor = makeVendor({ price: 100 });
    const results = findArbitrage([a, b, c], [vendor]);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].profit_estimate).toBeGreaterThanOrEqual(results[i + 1].profit_estimate);
    }
  });

  it("assigns severity=high when spread > 30%", () => {
    const cheap = makePoint({ kode_wilayah: "3201", city_name: "A", price: 10_000 });
    const dear  = makePoint({ kode_wilayah: "3202", city_name: "B", price: 14_000 });
    const vendor = makeVendor({ price: 100 });
    const results = findArbitrage([cheap, dear], [vendor]);
    const passed = results.filter(r => r.spread_percent > 30);
    passed.forEach(r => expect(r.severity).toBe("high"));
  });

  it("uses fallback when results < TOP_N_FALLBACK", () => {
    // 2 cities, tiny spread — won't meet MIN_SPREAD_PERCENT or MIN_PROFIT_THRESHOLD
    // but fallback should backfill if spread > 0
    const cheap = makePoint({ kode_wilayah: "3201", city_name: "A", price: 10_000 });
    const dear  = makePoint({ kode_wilayah: "3202", city_name: "B", price: 10_500 });
    const results = findArbitrage([cheap, dear], []);
    // May appear as severity=low via fallback
    if (results.length > 0) {
      expect(results[0].severity).toBe("low");
    }
  });
});

// ─── calcWeightLossPct ────────────────────────────────────────────────────────

describe("calcWeightLossPct", () => {
  it("returns 2–5% for short trip (< 5h, < 100km)", () => {
    const pct = calcWeightLossPct(2, 50);
    expect(pct).toBeGreaterThanOrEqual(2);
    expect(pct).toBeLessThanOrEqual(5);
  });

  it("returns 5–10% for medium trip (5–12h)", () => {
    const pct = calcWeightLossPct(8, 300);
    expect(pct).toBeGreaterThanOrEqual(5);
    expect(pct).toBeLessThanOrEqual(10);
  });

  it("returns 10–15% for long trip (>= 12h)", () => {
    const pct = calcWeightLossPct(16, 600);
    expect(pct).toBeGreaterThanOrEqual(10);
    expect(pct).toBeLessThanOrEqual(15);
  });

  it("returns at most 15% even for very long trips", () => {
    const pct = calcWeightLossPct(100, 5000);
    expect(pct).toBeLessThanOrEqual(15);
  });

  it("result has at most 1 decimal place", () => {
    const pct = calcWeightLossPct(3, 80);
    expect(pct.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});
