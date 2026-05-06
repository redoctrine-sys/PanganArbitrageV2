import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/utils/date";
import { CHART_DAYS_DEFAULT, CHART_DAYS_MAX, PRICE_LIMIT_PER_QUERY } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/prices?source=sp2kp&kode_wilayah=...&commodity_id=...&days=30
// GET /api/prices?source=pihps&city_raw=...&commodity_raw=...&days=30
//
// SP2KP filters by kode_wilayah/commodity_id (BPS canonical). PIHPS doesn't
// have BPS mapping for every city — filter by raw text fields instead.
// Default source=sp2kp preserves existing SP2KP callers.
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const source = (searchParams.get("source") ?? "sp2kp").toLowerCase();
  const days = Math.max(1, Math.min(CHART_DAYS_MAX, parseInt(searchParams.get("days") ?? String(CHART_DAYS_DEFAULT), 10)));

  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  // Route reads to isolated Bronze tables (Medallion Architecture)
  const SOURCE_TABLE: Record<string, string> = {
    sp2kp:     "sp2kp_raw",
    pihps:     "pihps_raw",
    facebook:  "facebook_raw",
    paskomnas: "paskomnas_raw",
  };
  const table = SOURCE_TABLE[source] ?? "v_prices_comparison";

  // sp2kp_raw has het_ha + kode_wilayah; others do not
  const selectCols = source === "sp2kp"
    ? "date, price, het_ha, kode_wilayah, commodity_id, city_raw, commodity_raw"
    : "date, price, city_raw, commodity_raw, commodity_id";

  let query = sb
    .from(table)
    .select(selectCols)
    .gte("date", daysAgoIso(days))
    .order("date", { ascending: true })
    .limit(PRICE_LIMIT_PER_QUERY);

  if (source === "sp2kp") {
    const kode_wilayah = searchParams.get("kode_wilayah");
    const commodity_id = searchParams.get("commodity_id");
    if (kode_wilayah) query = query.eq("kode_wilayah", kode_wilayah);
    if (commodity_id) query = query.eq("commodity_id", commodity_id);
  } else {
    const city_raw = searchParams.get("city_raw");
    const commodity_raw = searchParams.get("commodity_raw");
    if (city_raw) query = query.eq("city_raw", city_raw);
    if (commodity_raw) query = query.eq("commodity_raw", commodity_raw);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
