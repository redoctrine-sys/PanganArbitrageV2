import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  // PostgREST default cap is 1000 rows; current scope ≤ 200 cities so a single
  // query suffices. Order by kode_wilayah for stable display.
  const { data, error } = await sb
    .from("cities")
    .select("id, kode_wilayah, name, name_sp2kp, province, island, entity_type, lat, lng")
    .order("kode_wilayah", { ascending: true })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
