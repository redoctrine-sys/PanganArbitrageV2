import { NextResponse } from "next/server";
import { parseSP2KP } from "@/lib/csv/sp2kp-parser";
import { getServerClient } from "@/lib/supabase/server";
import type { PreviewResponse } from "@/types/sp2kp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body bukan multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Field 'file' tidak ada" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseSP2KP(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Parser error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Tanpa Supabase: return preview offline supaya UI bisa boot di lokal tanpa env.
  let duplicates_skipped = 0;

  try {
    const sb = getServerClient();
    const dateList = parsed.dates_found;
    const cityList = [...new Set(parsed.rows.map((r) => r.city_raw))];

    if (dateList.length > 0 && cityList.length > 0) {
      const { data: existing, error } = await sb
        .from("prices_raw")
        .select("date, city_raw, commodity_raw")
        .in("date", dateList)
        .in("city_raw", cityList)
        .eq("source", "sp2kp");
      if (!error && existing) {
        const existingSet = new Set(
          existing.map((e) => `${e.date}||${e.city_raw}||${e.commodity_raw}`),
        );
        duplicates_skipped = parsed.rows.filter((r) =>
          existingSet.has(`${r.date}||${r.city_raw}||${r.commodity_raw}`),
        ).length;
      }
    }
  } catch {
    // Supabase belum di-set — fallback: hitung diff dengan DB tidak dilakukan.
  }

  const unique_cities = new Set(parsed.rows.map((r) => r.city_raw)).size;

  const body: PreviewResponse = {
    dates_found: parsed.dates_found,
    total_rows_file: parsed.total_rows_file,
    total_rows_scope: parsed.total_rows_scope,
    total_observations: parsed.total_observations,
    rows_preview: parsed.rows.slice(0, 10),
    total_parsed: parsed.rows.length,
    duplicates_skipped,
    rows_will_insert: Math.max(0, parsed.rows.length - duplicates_skipped),
    unique_cities,
    warnings: parsed.warnings,
  };

  return NextResponse.json(body);
}
