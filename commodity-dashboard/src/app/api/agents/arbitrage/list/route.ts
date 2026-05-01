// GET /api/agents/arbitrage/list — fetch alerts with server-side type/severity filter

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  let reader;
  try { reader = getServerClient(); }
  catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase error", data: [] },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get("type")     ?? "all";
  const severity = searchParams.get("severity") ?? "all";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  let query = reader
    .from("arbitrage_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type !== "all") {
    query = query.eq("type", type);
  }

  if (severity !== "all") {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }

  const rows = data ?? [];
  const anomalies  = rows.filter((d) => d.type === "anomaly").length;
  const arbitrage  = rows.filter((d) => d.type === "arbitrage").length;

  return NextResponse.json({
    data: rows,
    total: rows.length,
    anomalies,
    arbitrage,
  });
}
