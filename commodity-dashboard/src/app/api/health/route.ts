import { NextResponse } from "next/server";
import { getServiceClient, getSupabaseUrlPrefix } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic endpoint untuk verifikasi end-to-end Supabase connection +
// migration status. Pakai untuk troubleshoot setelah deploy.
//
// GET /api/health → { ok: true, supabase_url: "...", commodities_count: 17,
//                      cities_count: 0, prices_count: 0, rpcs: {...} }
export async function GET() {
  const checks: Record<string, unknown> = {
    supabase_url: getSupabaseUrlPrefix(),
  };

  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        stage: "init_client",
        error: err instanceof Error ? err.message : String(err),
        ...checks,
      },
      { status: 500 },
    );
  }

  // 1. Cek tabel commodities + count
  const cmRes = await sb.from("commodities").select("id", { count: "exact", head: true });
  checks.commodities_count = cmRes.count;
  checks.commodities_error =
    cmRes.error?.message ?? (cmRes.count == null ? "silent fail (URL kemungkinan malformed)" : null);

  // 2. Cek tabel cities + count
  const ciRes = await sb.from("cities").select("id", { count: "exact", head: true });
  checks.cities_count = ciRes.count;
  checks.cities_error =
    ciRes.error?.message ?? (ciRes.count == null ? "silent fail" : null);

  // 3. Cek tabel prices_raw + count
  const prRes = await sb.from("prices_raw").select("id", { count: "exact", head: true });
  checks.prices_count = prRes.count;
  checks.prices_error =
    prRes.error?.message ?? (prRes.count == null ? "silent fail" : null);

  // 4. Probe RPC bulk_insert (kirim array kosong → harus return {inserted: 0})
  const bulkRes = await sb.rpc("bulk_insert_sp2kp_prices", { p_rows: [] });
  checks.rpc_bulk_insert = bulkRes.error
    ? { ok: false, error: bulkRes.error.message }
    : { ok: true, result: bulkRes.data };

  // 5. Probe RPC auto_seed_cities
  const seedRes = await sb.rpc("auto_seed_cities");
  checks.rpc_auto_seed = seedRes.error
    ? { ok: false, error: seedRes.error.message }
    : { ok: true, result: seedRes.data };

  // 6. Probe RPC get_sp2kp_latest
  const latestRes = await sb.rpc("get_sp2kp_latest");
  checks.rpc_get_latest = latestRes.error
    ? { ok: false, error: latestRes.error.message }
    : { ok: true, rows_returned: Array.isArray(latestRes.data) ? latestRes.data.length : null };

  const anyError =
    cmRes.error ||
    ciRes.error ||
    prRes.error ||
    bulkRes.error ||
    seedRes.error ||
    latestRes.error ||
    cmRes.count == null;

  return NextResponse.json(
    {
      ok: !anyError,
      ...checks,
      timestamp: new Date().toISOString(),
    },
    { status: anyError ? 500 : 200 },
  );
}
