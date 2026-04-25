import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import type { ParsedRow } from "@/types/sp2kp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IngestBody {
  rows: ParsedRow[];
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada rows" }, { status: 400 });
  }

  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: commodities, error: cErr } = await sb
    .from("commodities")
    .select("id, name")
    .eq("is_sp2kp", true);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  const commMap = new Map((commodities ?? []).map((c) => [c.name, c.id as string]));

  const { data: cities, error: ciErr } = await sb
    .from("cities")
    .select("id, kode_wilayah, name_sp2kp");
  if (ciErr) return NextResponse.json({ error: ciErr.message }, { status: 500 });
  const cityByKode = new Map<string, string>();
  const cityByName = new Map<string, string>();
  for (const c of cities ?? []) {
    if (c.kode_wilayah) cityByKode.set(c.kode_wilayah, c.id as string);
    if (c.name_sp2kp) cityByName.set(c.name_sp2kp, c.id as string);
  }

  const toInsert = rows.map((r) => ({
    date: r.date,
    city_raw: r.city_raw,
    commodity_raw: r.commodity_raw,
    price: r.price,
    het_ha: r.het_ha,
    source: "sp2kp",
    kode_wilayah: r.kode_wilayah,
    city_id: cityByKode.get(r.kode_wilayah) ?? cityByName.get(r.city_raw) ?? null,
    commodity_id: commMap.get(r.commodity_raw) ?? null,
  }));

  const batchSize = 500;
  let upserted = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { data, error } = await sb
      .from("prices_raw")
      .upsert(batch, {
        onConflict: "date,city_raw,commodity_raw,source",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      return NextResponse.json(
        { error: error.message, upserted_so_far: upserted },
        { status: 500 },
      );
    }
    upserted += data?.length ?? 0;
  }

  const new_cities_detected = [
    ...new Set(toInsert.filter((r) => r.city_id === null).map((r) => r.city_raw)),
  ];
  const unresolved_commodities = [
    ...new Set(
      toInsert.filter((r) => r.commodity_id === null).map((r) => r.commodity_raw),
    ),
  ];

  return NextResponse.json({
    received: toInsert.length,
    inserted: upserted,
    skipped_duplicates: toInsert.length - upserted,
    new_cities_detected,
    unresolved_commodities,
  });
}
