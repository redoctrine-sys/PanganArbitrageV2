import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require("ws") as typeof globalThis.WebSocket;
import type { ScrapedPrice } from "./types";

let cached: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("SUPABASE_URL not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  cached = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  });
  return cached;
}

export interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * Upsert scraped prices to isolated source tables (Medallion Bronze layer).
 *
 * Routes:
 *   source='pihps'     → pihps_raw     UNIQUE(date, city_raw, commodity_raw, market_type)
 *   source='paskomnas' → paskomnas_raw  UNIQUE(date, city_raw, commodity_raw)
 *   source='facebook'  → facebook_raw   UNIQUE(date, city_raw, commodity_raw)
 *
 * SP2KP is handled separately via bulk_insert_sp2kp_prices() RPC.
 */
export async function upsertPrices(prices: ScrapedPrice[]): Promise<UpsertStats> {
  if (prices.length === 0) return { inserted: 0, updated: 0, skipped: 0 };
  const sb = getClient();

  let totalInserted = 0;
  let totalSkipped = 0;

  // ── PIHPS → pihps_raw ──────────────────────────────────────────────────────
  const pihpsPrices = prices.filter((p) => p.source === "pihps");
  if (pihpsPrices.length > 0) {
    // Deduplicate by unique key to prevent "affect row a second time" error.
    // Concurrent regency drill can produce duplicate (date,city,commodity,market_type)
    // tuples if the same city name appears in multiple province responses.
    const pihpsDeduped = new Map<string, typeof pihpsPrices[0]>();
    for (const p of pihpsPrices) {
      const key = `${p.date}|||${p.city_raw}|||${p.commodity_raw}|||${p.market_name ?? ""}`;
      pihpsDeduped.set(key, p); // last-write-wins (same price expected anyway)
    }
    const rows = Array.from(pihpsDeduped.values()).map((p) => ({
      date: p.date,
      city_raw: p.city_raw,
      commodity_raw: p.commodity_raw,
      price: p.price,
      market_type: p.market_name ?? "",
      kode_wilayah: null as null,
      city_id: null as null,
      commodity_id: null as null,
    }));

    const { count, error } = await sb
      .from("pihps_raw")
      .upsert(rows, {
        onConflict: "date,city_raw,commodity_raw,market_type",
        ignoreDuplicates: false,
        count: "exact",
      });

    if (error) throw new Error(`pihps_raw upsert failed: ${error.message}`);
    totalInserted += count ?? rows.length;
  }

  // ── Paskomnas → paskomnas_raw ───────────────────────────────────────────────
  const pasPrices = prices.filter((p) => p.source === "paskomnas");
  if (pasPrices.length > 0) {
    const rows = pasPrices.map((p) => ({
      date: p.date,
      city_raw: p.city_raw,
      commodity_raw: p.commodity_raw,
      price: p.price,
      market_name: p.market_name ?? null,
      kode_wilayah: null as null,
      city_id: null as null,
      commodity_id: null as null,
    }));

    const { count, error } = await sb
      .from("paskomnas_raw")
      .upsert(rows, {
        onConflict: "date,city_raw,commodity_raw",
        ignoreDuplicates: false,
        count: "exact",
      });

    if (error) throw new Error(`paskomnas_raw upsert failed: ${error.message}`);
    totalInserted += count ?? rows.length;
  }

  // ── Facebook → facebook_raw ─────────────────────────────────────────────────
  const fbPrices = prices.filter((p) => p.source === "facebook");
  if (fbPrices.length > 0) {
    const rows = fbPrices.map((p) => ({
      date: p.date,
      city_raw: p.city_raw,
      commodity_raw: p.commodity_raw,
      price: p.price,
      confidence: p.confidence ?? null,
      city_id: null as null,
      commodity_id: null as null,
    }));

    const { count, error } = await sb
      .from("facebook_raw")
      .upsert(rows, {
        onConflict: "date,city_raw,commodity_raw",
        ignoreDuplicates: false,
        count: "exact",
      });

    if (error) throw new Error(`facebook_raw upsert failed: ${error.message}`);
    totalInserted += count ?? rows.length;
  }

  // Unknown sources
  const unknownCount = prices.filter(
    (p) => !["pihps", "paskomnas", "facebook"].includes(p.source),
  ).length;
  totalSkipped += unknownCount;

  return { inserted: totalInserted, updated: 0, skipped: totalSkipped };
}
