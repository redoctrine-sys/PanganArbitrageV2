import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const island = searchParams.get("island");
  const province = searchParams.get("province");

  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    // 200 + empty agar UI bisa render placeholder/empty state.
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  const { data, error } = await sb.rpc("get_sp2kp_latest", {
    p_island: island,
    p_province: province,
  });
  if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
