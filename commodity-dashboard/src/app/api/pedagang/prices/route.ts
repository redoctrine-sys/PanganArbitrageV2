import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pedagang/prices
 *
 * Fetches prices from prices_raw where source = 'facebook'
 * (captured via PanganScraper Chrome Extension).
 * Returns sorted by date DESC, limited to recent 500 rows.
 *
 * Query params:
 *   ?commodity=xxx  — filter by commodity_raw (ILIKE)
 *   ?city=xxx       — filter by city_raw (ILIKE)
 *   ?days=7         — how many days back (default 30)
 */
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const commodity = searchParams.get("commodity");
  const city = searchParams.get("city");
  const days = parseInt(searchParams.get("days") || "30", 10);

  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  // Calculate date cutoff
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Build query
  let query = sb
    .from("prices_raw")
    .select("id, date, city_raw, commodity_raw, price, source, created_at")
    .eq("source", "facebook")
    .gte("date", cutoffStr)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (commodity) {
    query = query.ilike("commodity_raw", `%${commodity}%`);
  }
  if (city) {
    query = query.ilike("city_raw", `%${city}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }

  // Compute summary stats
  const rows = data ?? [];
  const uniqueCommodities = [...new Set(rows.map(r => r.commodity_raw))];
  const uniqueCities = [...new Set(rows.map(r => r.city_raw))];
  const latestDate = rows.length > 0 ? rows[0].date : null;

  return NextResponse.json({
    data: rows,
    stats: {
      total: rows.length,
      commodities: uniqueCommodities.length,
      cities: uniqueCities.length,
      latestDate,
      uniqueCommodities,
      uniqueCities,
    },
  });
}
