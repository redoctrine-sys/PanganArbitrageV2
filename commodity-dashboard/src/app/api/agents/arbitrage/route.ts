// @domain: arbitrage-agent
// @feature: api-route
// POST /api/agents/arbitrage
// Runs Layer 1 (statistical) + Layer 2 (Gemini) and stores results.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectAnomalies, findArbitrage } from "@/lib/analytics/arbitrage";
import { analyzeWithGemini } from "@/lib/ai/agents/arbitrage/gemini-agent";
import type { PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";
import type { AlertRunResult } from "@/lib/ai/agents/arbitrage/types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function POST(): Promise<NextResponse> {
  const supabase = getServiceClient();
  const run_id = crypto.randomUUID();

  try {
    // ── Fetch data ──────────────────────────────────────────────────────────
    const [pricesRes, vendorsRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/rpc/get_sp2kp_latest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({}),
      }),
      supabase.from("transport_vendors").select("id, name, pricing_type, price, capacity_kg, base_fare_rp, base_km, coverage"),
    ]);

    if (!pricesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch prices" }, { status: 502 });
    }

    const rawPrices = await pricesRes.json() as Record<string, unknown>[];
    const vendors: Vendor[] = (vendorsRes.data ?? []) as Vendor[];

    // Map Supabase rows → PricePoint
    const points: PricePoint[] = rawPrices
      .filter((r) => r.price_latest != null)
      .map((r) => ({
        kode_wilayah: String(r.kode_wilayah ?? ""),
        city_name:    String(r.city_raw ?? ""),
        commodity_id: String(r.commodity_id ?? ""),
        commodity_name: String(r.commodity_name ?? ""),
        price:   Number(r.price_latest),
        het_ha:  r.het_ha != null ? Number(r.het_ha) : null,
        date:    String(r.date_latest ?? ""),
        province: String(r.province ?? ""),
        island:   String(r.island ?? ""),
      }));

    // ── Layer 1: Statistical ────────────────────────────────────────────────
    const anomalies   = detectAnomalies(points);
    const opportunities = findArbitrage(points, vendors);

    // ── Layer 2: Gemini AI ──────────────────────────────────────────────────
    const geminiResult = await analyzeWithGemini(anomalies, opportunities);
    const geminiUsed = geminiResult.ai_confidence > 0;

    // ── Store alerts ────────────────────────────────────────────────────────
    const alertRows = [
      ...anomalies.map((a) => ({
        run_id,
        type:           "anomaly",
        severity:       a.severity,
        commodity_id:   a.commodity_id,
        commodity_name: a.commodity_name,
        city_name:      a.city_name,
        price:          a.price,
        het_ha:         a.het_ha,
        excess_percent: a.excess_percent,
        insights:         geminiUsed ? geminiResult.insights        : null,
        recommended_actions: geminiUsed ? geminiResult.recommended_actions : null,
        risk_factors:     geminiUsed ? geminiResult.risk_factors    : null,
        ai_signal:        geminiUsed ? geminiResult.ai_signal       : null,
        ai_confidence:    geminiUsed ? geminiResult.ai_confidence   : null,
      })),
      ...opportunities.map((o) => ({
        run_id,
        type:           "arbitrage",
        severity:       o.severity,
        commodity_id:   o.commodity_id,
        commodity_name: o.commodity_name,
        city_from:      o.city_from,
        city_to:        o.city_to,
        price_buy:      o.price_buy,
        price_sell:     o.price_sell,
        price_spread:   o.price_spread,
        spread_percent: o.spread_percent,
        volume_kg:      o.volume_kg,
        transport_cost: o.transport_cost,
        profit_estimate: o.profit_estimate,
        vendor_name:    o.vendor_name,
        insights:         geminiUsed ? geminiResult.insights        : null,
        recommended_actions: geminiUsed ? geminiResult.recommended_actions : null,
        risk_factors:     geminiUsed ? geminiResult.risk_factors    : null,
        ai_signal:        geminiUsed ? geminiResult.ai_signal       : null,
        ai_confidence:    geminiUsed ? geminiResult.ai_confidence   : null,
      })),
    ];

    let total_inserted = 0;
    if (alertRows.length > 0) {
      const { count, error } = await supabase
        .from("arbitrage_alerts")
        .insert(alertRows, { count: "exact" });
      if (error) console.error("[Arbitrage Agent] Insert error:", error);
      total_inserted = count ?? 0;
    }

    const result: AlertRunResult = {
      run_id,
      anomalies,
      opportunities,
      total_inserted,
      gemini_used: geminiUsed,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Arbitrage Agent] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
