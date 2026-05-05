import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScrapedPrice } from "./types";

let cached: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("SUPABASE_URL not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * Upsert scraped prices to prices_raw.
 * UNIQUE constraint: (date, city_raw, commodity_raw, source).
 * Strategy: bulk upsert with onConflict — DB resolves insert vs update.
 *
 * Note: PostgREST upsert returns a single count; differentiating insert vs
 * update requires a pre-check. For Phase 1 we report a single "writes" count
 * (mapped to inserted). DB-side conditional logic can be added later if needed.
 */
export async function upsertPrices(prices: ScrapedPrice[]): Promise<UpsertStats> {
  if (prices.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
  const sb = getClient();

  const rows = prices.map((p) => ({
    date: p.date,
    city_raw: p.city_raw,
    commodity_raw: p.commodity_raw,
    source: p.source,
    price: p.price,
    het_ha: null,
    kode_wilayah: null,
    city_id: null,
    commodity_id: null,
  }));

  const { error, count } = await sb
    .from("prices_raw")
    .upsert(rows, {
      onConflict: "date,city_raw,commodity_raw,source",
      ignoreDuplicates: false,
      count: "exact",
    });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  return { inserted: count ?? rows.length, updated: 0, skipped: 0 };
}
