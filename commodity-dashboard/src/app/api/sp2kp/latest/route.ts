import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_ISLANDS = ["Jawa", "Madura", "Bali", "Lombok"] as const;

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

  // Supabase PostgREST server-side default = max 1000 rows per request.
  // Full dataset ≈ 80 kota × 17 komoditas = ~1360 rows → terpotong.
  // Solusi: jika tidak ada island filter ("Semua"), fetch per island secara paralel
  // lalu merge — setiap island < 1000 rows sehingga tidak kena limit.
  if (!island) {
    const results = await Promise.all(
      ALL_ISLANDS.map((isl) =>
        sb.rpc("get_sp2kp_latest", {
          p_island: isl,
          p_province: province,
        })
      )
    );

    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      return NextResponse.json({ error: firstError.error.message, data: [] }, { status: 500 });
    }

    const merged = results.flatMap((r) => r.data ?? []);
    return NextResponse.json({ data: merged });
  }

  const { data, error } = await sb.rpc("get_sp2kp_latest", {
    p_island: island,
    p_province: province,
  });
  if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
