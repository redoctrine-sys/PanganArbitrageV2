import { NextResponse } from "next/server";
import { parseSP2KP } from "@/lib/csv/sp2kp-parser";
import { getServiceClient, getSupabaseUrlPrefix } from "@/lib/supabase/server";

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function fmtSupabaseError(err: SupabaseLikeError | null | undefined, ctx: string) {
  if (!err) return `${ctx}: unknown error`;
  const parts = [
    `${ctx}: ${err.message ?? "(no message)"}`,
    err.code ? `code=${err.code}` : null,
    err.details ? `details=${err.details}` : null,
    err.hint ? `hint=${err.hint}` : null,
    `supabase_url=${getSupabaseUrlPrefix()}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro: 60s. Hobby ignore (capped 10s) — chunked parallel insert
// dirancang selesai dalam <10s untuk file SP2KP standar (~155k observasi).
export const maxDuration = 60;

// Chunk size & concurrency dipilih supaya:
//   - Body JSON per RPC call < 1MB (PostgREST default body limit)
//   - 155k rows / 5000 = 31 chunks → 8 batch parallel × 4 concurrent ≈ 6-8s
const CHUNK_SIZE = 5000;
const CONCURRENCY = 4;

export async function POST(req: Request): Promise<NextResponse> {
  // Terima file via multipart/form-data — body 3MB, bukan 22MB JSON
  // (memenuhi Vercel function body limit 4.5MB).
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

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris yang lolos filter scope" }, { status: 400 });
  }

  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Resolve commodity_id dari nama (17 komoditas SP2KP sudah seeded → exact match)
  const { data: commodities, error: cErr } = await sb
    .from("commodities")
    .select("id, name")
    .eq("is_sp2kp", true);
  if (cErr) {
    return NextResponse.json(
      { error: fmtSupabaseError(cErr, "Query commodities gagal") },
      { status: 500 },
    );
  }
  if (!commodities || commodities.length === 0) {
    return NextResponse.json(
      {
        error:
          "Tabel commodities kosong. Jalankan migration 002_seed_commodities.sql " +
          "(atau supabase/setup.sql) di Supabase SQL Editor terlebih dahulu.",
      },
      { status: 500 },
    );
  }
  const commMap = new Map((commodities ?? []).map((c) => [c.name, c.id as string]));

  // Build payload utk RPC: tambah commodity_id, biarkan city_id NULL
  // (auto_seed_cities akan backfill berdasarkan kode_wilayah)
  const rowsForInsert = parsed.rows.map((r) => ({
    date:          r.date,
    city_raw:      r.city_raw,
    commodity_raw: r.commodity_raw,
    price:         r.price,
    het_ha:        r.het_ha,
    kode_wilayah:  r.kode_wilayah,
    commodity_id:  commMap.get(r.commodity_raw) ?? null,
  }));

  // Chunked bulk insert via RPC, dengan parallelism limit
  const chunks: typeof rowsForInsert[] = [];
  for (let i = 0; i < rowsForInsert.length; i += CHUNK_SIZE) {
    chunks.push(rowsForInsert.slice(i, i + CHUNK_SIZE));
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const slice = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map((chunk) =>
        sb.rpc("bulk_insert_sp2kp_prices", { p_rows: chunk }),
      ),
    );
    for (const { data, error } of results) {
      if (error) {
        return NextResponse.json(
          {
            error: fmtSupabaseError(error, "RPC bulk_insert_sp2kp_prices gagal"),
            inserted_so_far: totalInserted,
            updated_so_far:  totalUpdated,
            hint:
              "Pastikan migration 005_bulk_insert_fn.sql sudah dijalankan, " +
              "dan NEXT_PUBLIC_SUPABASE_URL di Vercel benar (tanpa trailing slash).",
          },
          { status: 500 },
        );
      }
      const payload = data as {
        inserted: number;
        updated: number;
        unchanged: number;
      } | null;
      totalInserted  += payload?.inserted  ?? 0;
      totalUpdated   += payload?.updated   ?? 0;
      totalUnchanged += payload?.unchanged ?? 0;
    }
  }

  // Auto-seed cities + backfill city_id (single RPC, non-parallel)
  let auto_seed: { seeded: number; backfilled: number } = { seeded: 0, backfilled: 0 };
  const { data: seedData, error: seedErr } = await sb.rpc("auto_seed_cities");
  if (!seedErr && seedData) {
    auto_seed = seedData as { seeded: number; backfilled: number };
  }

  const unresolved_commodities = [
    ...new Set(
      rowsForInsert.filter((r) => r.commodity_id === null).map((r) => r.commodity_raw),
    ),
  ];

  return NextResponse.json({
    received:         parsed.rows.length,
    inserted:         totalInserted,
    updated:          totalUpdated,
    unchanged:        totalUnchanged,
    cities_seeded:    auto_seed.seeded,
    rows_backfilled:  auto_seed.backfilled,
    chunks_processed: chunks.length,
    parse_warnings:   parsed.warnings,
    unresolved_commodities,
  });
}
