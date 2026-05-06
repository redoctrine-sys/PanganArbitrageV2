import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scraper/ingest
 *
 * Receives user-accepted prices from the PanganScraper Chrome Extension
 * (or any external scraper agent). Validates, deduplicates, and upserts
 * into prices_raw with the given source field.
 *
 * Body: {
 *   source: "facebook" | "pihps" | "paskomnas",
 *   prices: Array<{
 *     commodity_raw: string,
 *     price: number,
 *     unit: string,
 *     city_raw: string,
 *     date: string,        // YYYY-MM-DD
 *     confidence?: number,
 *     source_url?: string
 *   }>
 * }
 */

interface ScraperPrice {
  commodity_raw: string;
  price: number;
  unit: string;
  city_raw: string;
  date: string;
  confidence?: number;
  source_url?: string;
}

interface IngestBody {
  source: string;
  prices: ScraperPrice[];
}

const VALID_SOURCES = ["facebook", "pihps", "paskomnas"];
const MAX_PRICES_PER_REQUEST = 100;

export async function POST(req: Request): Promise<NextResponse> {
  // ── Parse body ─────────────────────────────────────────────────────
  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // ── Validate source ────────────────────────────────────────────────
  if (!body.source || !VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  // ── Validate prices array ──────────────────────────────────────────
  if (!Array.isArray(body.prices) || body.prices.length === 0) {
    return NextResponse.json(
      { error: "prices must be a non-empty array" },
      { status: 400 }
    );
  }

  if (body.prices.length > MAX_PRICES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PRICES_PER_REQUEST} prices per request` },
      { status: 400 }
    );
  }

  // ── Validate each price item ───────────────────────────────────────
  const errors: string[] = [];
  const validPrices: ScraperPrice[] = [];

  for (let i = 0; i < body.prices.length; i++) {
    const p = body.prices[i];

    if (!p.commodity_raw || typeof p.commodity_raw !== "string") {
      errors.push(`[${i}] missing commodity_raw`);
      continue;
    }
    if (typeof p.price !== "number" || p.price <= 0) {
      errors.push(`[${i}] invalid price: ${p.price}`);
      continue;
    }
    if (!p.city_raw || typeof p.city_raw !== "string") {
      errors.push(`[${i}] missing city_raw`);
      continue;
    }
    if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
      errors.push(`[${i}] invalid date format (expected YYYY-MM-DD): ${p.date}`);
      continue;
    }

    // Sane price range check (Rp 500 — Rp 1,000,000)
    if (p.price < 500 || p.price > 1000000) {
      errors.push(`[${i}] price out of sane range (500-1000000): ${p.price}`);
      continue;
    }

    validPrices.push(p);
  }

  if (validPrices.length === 0) {
    return NextResponse.json(
      { error: "No valid prices after validation", validation_errors: errors },
      { status: 400 }
    );
  }

  // ── Get Supabase client ────────────────────────────────────────────
  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase not configured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Fuzzy match commodity names to commodity_id ────────────────────
  const { data: commodities } = await sb
    .from("commodities")
    .select("id, name");

  const commMap = new Map(
    (commodities ?? []).map((c: { id: string; name: string }) => [
      c.name.toLowerCase(),
      c.id,
    ])
  );

  // Simple fuzzy: check if commodity_raw contains or matches a known commodity
  function findCommodityId(raw: string): string | null {
    const lower = raw.toLowerCase();

    // Exact match first
    if (commMap.has(lower)) return commMap.get(lower)!;

    // Contains match
    for (const [name, id] of commMap) {
      if (lower.includes(name) || name.includes(lower)) {
        return id;
      }
    }

    return null;
  }

  // ── Route to isolated table by source (Medallion Bronze layer) ───────
  const TABLE_MAP: Record<string, { table: string; conflict: string }> = {
    pihps:     { table: "pihps_raw",     conflict: "date,city_raw,commodity_raw,market_type" },
    facebook:  { table: "facebook_raw",  conflict: "date,city_raw,commodity_raw" },
    paskomnas: { table: "paskomnas_raw", conflict: "date,city_raw,commodity_raw" },
  };

  const target = TABLE_MAP[body.source];
  if (!target) {
    return NextResponse.json({ error: `No table mapping for source: ${body.source}` }, { status: 400 });
  }

  const rows = validPrices.map((p) => {
    const base = {
      date: p.date,
      city_raw: p.city_raw,
      commodity_raw: p.commodity_raw,
      price: p.price,
      commodity_id: findCommodityId(p.commodity_raw),
    };
    if (body.source === "pihps") {
      return { ...base, market_type: "" };
    }
    if (body.source === "facebook") {
      return { ...base, confidence: p.confidence ?? null, source_url: p.source_url ?? null };
    }
    // paskomnas
    return base;
  });

  let inserted = 0;
  let updated = 0;
  const upsertErrors: string[] = [];

  for (const row of rows) {
    const { error } = await sb
      .from(target.table)
      .upsert(row, {
        onConflict: target.conflict,
        ignoreDuplicates: false,
      });

    if (error) {
      upsertErrors.push(`${(row as Record<string, unknown>).commodity_raw}@${(row as Record<string, unknown>).city_raw}: ${error.message}`);
    } else {
      inserted++;
    }
  }
  // ── Auto-seed cities if needed ─────────────────────────────────────
  let citiesSeeded = 0;
  try {
    const { data: seedData } = await sb.rpc("auto_seed_cities");
    citiesSeeded = (seedData as { seeded: number } | null)?.seeded ?? 0;
  } catch {
    // Non-critical — cities may already exist
  }

  return NextResponse.json({
    source: body.source,
    received: body.prices.length,
    valid: validPrices.length,
    inserted,
    updated,
    validation_errors: errors,
    upsert_errors: upsertErrors,
    cities_seeded: citiesSeeded,
  });
}
