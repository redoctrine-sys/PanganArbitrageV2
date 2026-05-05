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

  // ── Build rows for upsert ──────────────────────────────────────────
  const rows = validPrices.map((p) => ({
    date: p.date,
    city_raw: p.city_raw,
    commodity_raw: p.commodity_raw,
    price: p.price,
    source: body.source,
    commodity_id: findCommodityId(p.commodity_raw),
    // Store extra metadata in existing fields where possible
    het_ha: null, // not applicable for scraped data
  }));

  // ── Upsert: insert with ON CONFLICT (date, city_raw, commodity_raw, source) ──
  // Use individual upserts to handle deduplication properly
  let inserted = 0;
  let updated = 0;
  const upsertErrors: string[] = [];

  for (const row of rows) {
    const { error } = await sb
      .from("prices_raw")
      .upsert(row, {
        onConflict: "date,city_raw,commodity_raw,source",
        ignoreDuplicates: false,
      });

    if (error) {
      // If the conflict columns don't exist, fall back to simple insert
      const { error: insertError } = await sb
        .from("prices_raw")
        .insert(row);

      if (insertError) {
        upsertErrors.push(`${row.commodity_raw}@${row.city_raw}: ${insertError.message}`);
      } else {
        inserted++;
      }
    } else {
      inserted++;
    }
  }

  // ── Auto-seed cities if needed ─────────────────────────────────────
  const { data: seedData } = await sb.rpc("auto_seed_cities").catch(() => ({
    data: null,
  }));

  return NextResponse.json({
    source: body.source,
    received: body.prices.length,
    valid: validPrices.length,
    inserted,
    updated,
    validation_errors: errors,
    upsert_errors: upsertErrors,
    cities_seeded: (seedData as { seeded: number } | null)?.seeded ?? 0,
  });
}
