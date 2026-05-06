import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PIHPS latest snapshot. Same shape as /api/sp2kp/latest — returns
// SP2KPLatestRow[] so dashboard can reuse all SP2KP components.
// Mapping (city_raw → kode_wilayah/province/island, commodity_raw → commodity_id)
// happens inside the get_pihps_latest RPC via cities/commodities ILIKE join.
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const island = searchParams.get("island");
  const province = searchParams.get("province");

  // Use service role (no statement_timeout) — anon role has 3s limit which
  // would trigger on large PIHPS datasets as data grows.
  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  const { data, error } = await sb.rpc("get_pihps_latest", {
    p_island: island && island !== "Semua" ? island : null,
    p_province: province && province !== "Semua" ? province : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
