// GET /api/agents/arbitrage — fetch alerts dari DB
//   Fetches arbitrage + anomaly SEPARATELY to ensure both types always appear.
// POST /api/agents/arbitrage — run arbitrage analysis

import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { detectAnomalies, findArbitrage } from "@/lib/analytics/arbitrage";
import { analyzeWithGemini } from "@/lib/ai/agents/arbitrage/gemini-agent";
import type { PricePoint, Vendor } from "@/lib/ai/agents/arbitrage/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET: fetch stored alerts ─────────────────────────────────────────────────
// Fix: separate queries for anomaly and arbitrage to avoid LIMIT truncation.
// Previously LIMIT 100 returned 100 anomalies and 0 arbitrage opportunities.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const typeFilter     = searchParams.get("type") || "all";
  const severityFilter = searchParams.get("severity") || "all";

  let reader;
  try { reader = getServerClient(); }
  catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase error", data: [] });
  }

  try {
    // Fetch arbitrage opportunities (max 50) and anomalies (max 50) separately
    // so arbitrage is never truncated by anomaly volume.
    const [arbRes, anomRes] = await Promise.all([
      reader.from("arbitrage_alerts")
        .select("*")
        .eq("type", "arbitrage")
        .order("created_at", { ascending: false })
        .limit(50),
      reader.from("arbitrage_alerts")
        .select("*")
        .eq("type", "anomaly")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Merge: arbitrage first, then anomalies
    const allAlerts = [
      ...(arbRes.data ?? []),
      ...(anomRes.data ?? []),
    ];

    // Apply client-requested filters
    const filtered = allAlerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    });

    const arbCount  = allAlerts.filter((a) => a.type === "arbitrage").length;
    const anomCount = allAlerts.filter((a) => a.type === "anomaly").length;

    return NextResponse.json({
      data: filtered,
      counts: { arbitrage: arbCount, anomaly: anomCount, total: allAlerts.length },
    });

  } catch {
    return NextResponse.json({ data: [], db_error: "Table may not exist" });
  }
}

// ── POST: run analysis ───────────────────────────────────────────────────────
export async function POST(): Promise<NextResponse> {
  const run_id = crypto.randomUUID();

  let reader;
  try { reader = getServerClient(); }
  catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase belum dikonfigurasi" },
      { status: 500 }
    );
  }

  let writer;
  try { writer = getServiceClient(); }
  catch { writer = reader; }

  try {
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

    const { data: vendorRows } = await reader
      .from("transport_vendors")
      .select("id, name, pricing_type, price, capacity_kg, base_fare_rp, base_km, coverage");

    const vendors: Vendor[] = (vendorRows ?? []) as Vendor[];

    const points: PricePoint[] = rawPrices
      .filter((r) => r.price_latest != null && Number(r.price_latest) > 0)
      .map((r) => ({
        kode_wilayah:   String(r.kode_wilayah ?? ""),
        city_name:      String(r.city_raw ?? ""),
        commodity_id:   String(r.commodity_id ?? ""),
        commodity_name: String(r.commodity_name ?? ""),
        price:          Number(r.price_latest),
        het_ha:         r.het_ha   != null ? Number(r.het_ha)   : null,
        date:           String(r.date_latest ?? ""),
        province:       String(r.province ?? ""),
        island:         String(r.island ?? ""),
        latitude:  r.lat       != null ? Number(r.lat)       : null,
        longitude: r.lng       != null ? Number(r.lng)       : null,
        price_prev: r.price_prev != null ? Number(r.price_prev) : null,
        date_prev:  r.date_prev  != null ? String(r.date_prev)  : null,
        avg_30d:    r.avg_30d    != null ? Number(r.avg_30d)    : null,
        max_30d:    r.max_30d    != null ? Number(r.max_30d)    : null,
        min_30d:    r.min_30d    != null ? Number(r.min_30d)    : null,
      }));

    console.log(`[Arbitrage] run=${run_id} points=${points.length} vendors=${vendors.length}`);

    if (points.length === 0) {
      return NextResponse.json({
        run_id, anomalies: [], opportunities: [], total_inserted: 0,
        gemini_used: false, timestamp: new Date().toISOString(),
        warning: "Tidak ada data harga SP2KP.",
      });
    }

    const anomalies     = detectAnomalies(points);
    const opportunities = findArbitrage(points, vendors);

    console.log(`[Arbitrage] anomalies=${anomalies.length} opportunities=${opportunities.length}`);

    // Gemini insight: ONLY for arbitrage opportunities (not anomalies)
    // Anomalies are self-explanatory (price > HET).
    const geminiResult = await analyzeWithGemini(anomalies, opportunities);
    const geminiUsed   = geminiResult.ai_confidence > 0;

    // Delete previous run alerts to prevent accumulation
    await writer.from("arbitrage_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const alertRows = [
      // Anomaly rows: NO Gemini insights (HET anomaly is self-explanatory)
      ...anomalies.map((a) => ({
        run_id, type: "anomaly" as const, severity: a.severity,
        commodity_id: a.commodity_id, commodity_name: a.commodity_name,
        city_name: a.city_name, price: a.price, het_ha: a.het_ha,
        excess_percent: a.excess_percent,
        insights: null,
        recommended_actions: null,
        risk_factors: null,
        ai_signal: null,
        ai_confidence: null,
      })),
      // Arbitrage rows: attach Gemini insights
      ...opportunities.map((o) => ({
        run_id, type: "arbitrage" as const, severity: o.severity,
        commodity_id: o.commodity_id, commodity_name: o.commodity_name,
        city_from: o.city_from, city_to: o.city_to,
        price_buy: o.price_buy, price_sell: o.price_sell,
        price_spread: o.price_spread, spread_percent: o.spread_percent,
        volume_kg: o.volume_kg, transport_cost: o.transport_cost,
        profit_estimate: o.profit_estimate, vendor_name: o.vendor_name,
        distance_km: o.distance_km, transport_detail: o.transport_detail,
        eta_hours: o.eta_hours, weight_loss_pct: o.weight_loss_pct,
        volatility_pct: o.volatility_pct, volatility_label: o.volatility_label,
        volatility_pct_from: o.volatility_pct_from, volatility_label_from: o.volatility_label_from,
        spread_duration: o.spread_duration,
        spread_divergence_days: o.spread_divergence_days,
        spread_divergence_date: o.spread_divergence_date,
        avg_spread_pct: o.avg_spread_pct,
        profit_estimate_avg: o.profit_estimate_avg,
        logistic_risk: o.logistic_risk,
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
