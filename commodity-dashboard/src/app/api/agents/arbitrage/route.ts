// @domain: arbitrage-agent
// @feature: api-route
// POST /api/agents/arbitrage
// Runs Layer 1 (statistical) + Layer 2 (Gemini) and stores results.

import { NextResponse } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { detectAnomalies, findArbitrage } from "@/lib/analytics/arbitrage";
import { analyzeWithGemini } from "@/lib/ai/agents/arbitrage/gemini-agent";
import type { PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const run_id = crypto.randomUUID();

  // Read client — anon key, SECURITY DEFINER RPC sudah bypass RLS
  let reader;
  try { reader = getServerClient(); }
  catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase belum dikonfigurasi" },
      { status: 500 }
    );
  }

  // Service client — untuk INSERT ke arbitrage_alerts (ada RLS)
  let writer;
  try { writer = getServiceClient(); }
  catch { writer = reader; } // Graceful: fall back to anon if no service key

  try {
    // ── Fetch SP2KP per-province, parallel (sama seperti /api/sp2kp/latest) ──
    const PROVINCES = [
      "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta",
      "Jawa Timur", "Banten", "Bali", "Nusa Tenggara Barat",
    ];

    const results = await Promise.all(
      PROVINCES.map((prov) =>
        reader.rpc("get_sp2kp_latest", { p_island: null, p_province: prov })
      )
    );

    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      return NextResponse.json(
        { error: `RPC gagal: ${firstError.error.message}` },
        { status: 502 }
      );
    }

    const rawPrices = results.flatMap((r) => (r.data ?? []) as Record<string, unknown>[]);

    // ── Fetch vendors ────────────────────────────────────────────────────────
    const { data: vendorRows } = await reader
      .from("transport_vendors")
      .select("id, name, pricing_type, price, capacity_kg, base_fare_rp, base_km, coverage");

    const vendors: Vendor[] = (vendorRows ?? []) as Vendor[];

    // ── Map rows → PricePoint ────────────────────────────────────────────────
    const points: PricePoint[] = rawPrices
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

    console.log(`[Arbitrage] run=${run_id} points=${points.length} vendors=${vendors.length}`);

    if (points.length === 0) {
      return NextResponse.json({
        run_id, anomalies: [], opportunities: [], total_inserted: 0,
        gemini_used: false, timestamp: new Date().toISOString(),
        warning: "Tidak ada data harga SP2KP. Upload CSV terlebih dahulu.",
      });
    }

    // ── Layer 1: Statistical detection ───────────────────────────────────────
    const anomalies     = detectAnomalies(points);
    const opportunities = findArbitrage(points, vendors);

    console.log(`[Arbitrage] anomalies=${anomalies.length} opportunities=${opportunities.length}`);

    // ── Layer 2: Gemini ───────────────────────────────────────────────────────
    const geminiResult = await analyzeWithGemini(anomalies, opportunities);
    const geminiUsed   = geminiResult.ai_confidence > 0;

    // ── Store to DB ───────────────────────────────────────────────────────────
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
      const { count, error: insertErr } = await writer
        .from("arbitrage_alerts")
        .insert(alertRows, { count: "exact" });

      if (insertErr) {
        db_error = insertErr.message;
        console.error("[Arbitrage] Insert error:", insertErr.message);
      } else {
        total_inserted = count ?? 0;
      }
    }

    return NextResponse.json({
      run_id, anomalies, opportunities,
      total_inserted, gemini_used: geminiUsed,
      timestamp: new Date().toISOString(),
      ...(db_error ? { db_error } : {}),
    });

  } catch (err) {
    console.error("[Arbitrage Agent] Fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
