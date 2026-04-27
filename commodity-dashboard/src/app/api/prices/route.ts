import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/utils/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/prices?kode_wilayah=...&commodity_id=...&days=30
// Phase 1 SP2KP raw: filter by kode_wilayah (BPS deterministic) + commodity_id.
// Tidak ada gating "approved" — RLS policy sudah membatasi ke source='sp2kp'
// AND kode_wilayah/commodity_id NOT NULL.
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const kode_wilayah = searchParams.get("kode_wilayah");
  const commodity_id = searchParams.get("commodity_id");
  const days = Math.max(1, Math.min(400, parseInt(searchParams.get("days") ?? "30", 10)));

  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  let query = sb
    .from("prices_raw")
    .select("date, price, het_ha, kode_wilayah, commodity_id")
    .eq("source", "sp2kp")
    .gte("date", daysAgoIso(days))
    .order("date", { ascending: true })
    .limit(5000);

  if (kode_wilayah) query = query.eq("kode_wilayah", kode_wilayah);
  if (commodity_id) query = query.eq("commodity_id", commodity_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
