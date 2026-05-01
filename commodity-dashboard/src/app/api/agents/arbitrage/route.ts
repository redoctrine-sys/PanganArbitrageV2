// @domain: arbitrage-agent
// @feature: api-route
// POST /api/agents/arbitrage
// Runs Layer 1 (statistical) + Layer 2 (Gemini) and stores results.
// Gracefully handles missing arbitrage_alerts table.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectAnomalies, findArbitrage } from "@/lib/analytics/arbitrage";
import { analyzeWithGemini } from "@/lib/ai/agents/arbitrage/gemini-agent";
import type { PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";
import type { AlertRunResult } from "@/lib/ai/agents/arbitrage/types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars tidak dikonfigurasi");
  return createClient(url, key);
}

export async function POST(): Promise<NextResponse> {
  const run_id = crypto.randomUUID();

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase tidak terkonfigurasi" },
      { status: 500 }
    );
  }

  try {
    // ── Fetch SP2KP data via Supabase client ─────────────────────────────────
    // Must pass explicit null params — empty {} causes "Invalid path" error
    const { data: rawPrices, error: rpcErr } = await supabase
      .rpc("get_sp2kp_latest", { p_island: null, p_province: null });

    if (rpcErr) {
      return NextResponse.json(
        { error: `RPC get_sp2kp_latest gagal: ${rpcErr.message}` },
        { status: 502 }
      );
    }

    // ── Fetch vendors ────────────────────────────────────────────────────────
    const { data: vendorRows, error: vendorErr } = await supabase
      .from("transport_vendors")
      .select("id, name, pricing_type, price, capacity_kg, base_fare_rp, base_km, coverage");

    if (vendorErr) {
      console.warn("[Arbitrage Agent] Vendor fetch error:", vendorErr.message);
    }

    const vendors: Vendor[] = (vendorRows ?? []) as Vendor[];

    // Map RPC rows → PricePoint (only rows with actual price data)
    const points: PricePoint[] = ((rawPrices ?? []) as Record<string, unknown>[])
      .filter((r) => r.price_latest != null && Number(r.price_latest) > 0)
      .map((r) => ({
        kode_wilayah:   String(r.kode_wilayah ?? ""),
        city_name:      String(r.city_raw ?? ""),
        commodity_id:   String(r.commodity_id ?? ""),
        commodity_name: String(r.commodity_name ?? ""),
        price:          Number(r.price_latest),
        het_ha:         r.het_ha != null ? Number(r.het_ha) : null,
        date:           String(r.date_latest ?? ""),
        province:       String(r.province ?? ""),
        island:         String(r.island ?? ""),
      }));

    console.log(`[Arbitrage Agent] run_id=${run_id} points=${points.length} vendors=${vendors.length}`);

    if (points.length === 0) {
      return NextResponse.json({
        run_id, anomalies: [], opportunities: [], total_inserted: 0,
        gemini_used: false, timestamp: new Date().toISOString(),
        warning: "Tidak ada data harga SP2KP. Upload CSV SP2KP terlebih dahulu.",
      });
    }

    // ── Layer 1: Statistical ────────────────────────────────────────────────
    const anomalies    = detectAnomalies(points);
    const opportunities = findArbitrage(points, vendors);

    console.log(`[Arbitrage Agent] anomalies=${anomalies.length} opportunities=${opportunities.length}`);

    // ── Layer 2: Gemini AI ──────────────────────────────────────────────────
    const geminiResult = await analyzeWithGemini(anomalies, opportunities);
    const geminiUsed   = geminiResult.ai_confidence > 0;

    // ── Store alerts (graceful: skip if table missing) ──────────────────────
    const alertRows = [
      ...anomalies.map((a) => ({
        run_id, type: "anomaly", severity: a.severity,
        commodity_id: a.commodity_id, commodity_name: a.commodity_name,
        city_name: a.city_name, price: a.price, het_ha: a.het_ha,
        excess_percent: a.excess_percent,
        insights:            geminiUsed ? geminiResult.insights            : null,
        recommended_actions: geminiUsed ? geminiResult.recommended_actions : null,
        risk_factors:        geminiUsed ? geminiResult.risk_factors        : null,
        ai_signal:           geminiUsed ? geminiResult.ai_signal           : null,
        ai_confidence:       geminiUsed ? geminiResult.ai_confidence       : null,
      })),
      ...opportunities.map((o) => ({
        run_id, type: "arbitrage", severity: o.severity,
        commodity_id: o.commodity_id, commodity_name: o.commodity_name,
        city_from: o.city_from, city_to: o.city_to,
        price_buy: o.price_buy, price_sell: o.price_sell,
        price_spread: o.price_spread, spread_percent: o.spread_percent,
        volume_kg: o.volume_kg, transport_cost: o.transport_cost,
        profit_estimate: o.profit_estimate, vendor_name: o.vendor_name,
        insights:            geminiUsed ? geminiResult.insights            : null,
        recommended_actions: geminiUsed ? geminiResult.recommended_actions : null,
        risk_factors:        geminiUsed ? geminiResult.risk_factors        : null,
        ai_signal:           geminiUsed ? geminiResult.ai_signal           : null,
        ai_confidence:       geminiUsed ? geminiResult.ai_confidence       : null,
      })),
    ];

    let total_inserted = 0;
    let db_error: string | null = null;

    if (alertRows.length > 0) {
      const { count, error: insertErr } = await supabase
        .from("arbitrage_alerts")
        .insert(alertRows, { count: "exact" });

      if (insertErr) {
        // Table mungkin belum di-migrate — log tapi jangan fail
        db_error = insertErr.message;
        console.error("[Arbitrage Agent] Insert error (run migration 014):", insertErr.message);
      } else {
        total_inserted = count ?? 0;
      }
    }

    const result: AlertRunResult & { db_error?: string; warning?: string } = {
      run_id, anomalies, opportunities,
      total_inserted, gemini_used: geminiUsed,
      timestamp: new Date().toISOString(),
      ...(db_error ? { db_error } : {}),
      ...(alertRows.length === 0 ? { warning: "Tidak ada alert terdeteksi dari data SP2KP." } : {}),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Arbitrage Agent] Fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
