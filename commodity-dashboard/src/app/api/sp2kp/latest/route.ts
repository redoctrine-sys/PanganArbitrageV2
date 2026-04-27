import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Semua provinsi dalam scope SP2KP. Setiap provinsi maks ~38 kota × 17 komoditas
// ≈ 646 rows — jauh di bawah PostgREST 1000-row server limit.
const ALL_PROVINCES = [
  "DKI Jakarta",       // 31 — 6 kota
  "Jawa Barat",        // 32 — 27 kota
  "Jawa Tengah",       // 33 — 29 kota
  "DI Yogyakarta",     // 34 — ~5 kota
  "Jawa Timur",        // 35 — ~38 kota (termasuk Madura via island)
  "Banten",            // 36 — ~8 kota
  "Bali",              // 51 — 9 kota
  "Nusa Tenggara Barat", // 52 — 5 kota (Lombok only)
] as const;

// Mapping island → provinsi (utk filter island tanpa kena limit)
const ISLAND_PROVINCES: Record<string, readonly string[]> = {
  Jawa:   ["DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Banten"],
  Madura: ["Jawa Timur"],  // Madura = subset Jatim (kode 3526-3529), island filter di RPC
  Bali:   ["Bali"],
  Lombok: ["Nusa Tenggara Barat"],
};

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const island = searchParams.get("island");
  const province = searchParams.get("province");

  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  // Supabase PostgREST server-side limit = 1000 rows per request.
  // Strategi: selalu fetch per-provinsi secara paralel agar setiap chunk < 1000 rows.
  // Ini juga menghindari masalah island "Jawa" yang punya ~62 kota (>1000 rows).

  // Tentukan provinsi mana yang perlu di-fetch
  let targetProvinces: readonly string[];
  let rpcIsland: string | null = null;

  if (province && province !== "Semua") {
    // User pilih provinsi spesifik — single fetch, pasti < 1000 rows
    targetProvinces = [province];
  } else if (island) {
    // User pilih island — fetch provinsi-provinsi di island itu
    targetProvinces = ISLAND_PROVINCES[island] ?? [];
    rpcIsland = island;
    if (targetProvinces.length === 0) {
      return NextResponse.json({ data: [] });
    }
  } else {
    // "Semua" — fetch semua provinsi
    targetProvinces = ALL_PROVINCES;
  }

  // Jika hanya 1 provinsi, atau island = Madura/Bali/Lombok (< 1000 rows),
  // cukup single fetch dengan parameter asli.
  if (targetProvinces.length === 1 && !island) {
    const { data, error } = await sb.rpc("get_sp2kp_latest", {
      p_island: null,
      p_province: targetProvinces[0],
    });
    if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  if (island && ["Madura", "Bali", "Lombok"].includes(island)) {
    // Madura/Bali/Lombok: data sedikit, single fetch aman
    const { data, error } = await sb.rpc("get_sp2kp_latest", {
      p_island: island,
      p_province: null,
    });
    if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  // Parallel fetch per-provinsi
  const results = await Promise.all(
    targetProvinces.map((prov) =>
      sb.rpc("get_sp2kp_latest", {
        p_island: rpcIsland,
        p_province: prov,
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
