import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pedagang/latest
 *
 * Returns Facebook-sourced prices aggregated into SP2KPLatestRow shape
 * so the page can reuse CityRow, CommodityGroupRow, ChartPanel components.
 *
 * Unlike SP2KP (fixed 17 commodities), pedagang data is dynamic:
 * - Commodities are whatever the Chrome Extension captured
 * - Cities may not match kode_wilayah — uses city_raw as key
 * - Data may be sparse and irregular
 */

interface RawPrice {
  id: string;
  date: string;
  city_raw: string;
  commodity_raw: string;
  price: number;
  source: string;
  commodity_id: string | null;
  city_id: string | null;
}

interface CityInfo {
  id: string;
  name: string;
  kode_wilayah: string;
  province: string;
  island: string;
  entity_type: string | null;
}

interface CommodityInfo {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
}

export async function GET(): Promise<NextResponse> {
  let sb;
  try {
    sb = getServerClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase belum dikonfigurasi";
    return NextResponse.json({ error: msg, data: [] }, { status: 200 });
  }

  // Fetch all Facebook-sourced prices (last 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: rawPrices, error: priceError } = await sb
    .from("prices_raw")
    .select("id, date, city_raw, commodity_raw, price, source, commodity_id, city_id")
    .eq("source", "facebook")
    .gte("date", cutoffStr)
    .order("date", { ascending: false })
    .limit(5000);

  if (priceError) {
    return NextResponse.json({ error: priceError.message, data: [] }, { status: 500 });
  }

  const prices = (rawPrices ?? []) as RawPrice[];

  if (prices.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Fetch cities and commodities for enrichment
  const { data: cities } = await sb
    .from("cities")
    .select("id, name, kode_wilayah, province, island, entity_type");
  const { data: commodities } = await sb
    .from("commodities")
    .select("id, name, category, unit");

  const cityMap = new Map<string, CityInfo>();
  for (const c of (cities ?? []) as CityInfo[]) {
    cityMap.set(c.id, c);
    cityMap.set(c.name.toLowerCase(), c);
  }

  const commMap = new Map<string, CommodityInfo>();
  for (const c of (commodities ?? []) as CommodityInfo[]) {
    commMap.set(c.id, c);
    commMap.set(c.name.toLowerCase(), c);
  }

  // Group prices by (city_raw, commodity_raw)
  type GroupKey = string;
  interface PriceGroup {
    city_raw: string;
    commodity_raw: string;
    commodity_id: string | null;
    city_id: string | null;
    prices: { date: string; price: number }[];
  }

  const groups = new Map<GroupKey, PriceGroup>();

  for (const p of prices) {
    const key = `${p.city_raw}|||${p.commodity_raw}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        city_raw: p.city_raw,
        commodity_raw: p.commodity_raw,
        commodity_id: p.commodity_id,
        city_id: p.city_id,
        prices: [],
      };
      groups.set(key, g);
    }
    g.prices.push({ date: p.date, price: p.price });
  }

  // Transform groups into SP2KPLatestRow shape
  const rows = [];
  for (const g of groups.values()) {
    // Sort prices by date desc
    g.prices.sort((a, b) => b.date.localeCompare(a.date));

    const latest = g.prices[0];
    const prev = g.prices.length > 1 ? g.prices[1] : null;

    // 30-day stats
    const now = new Date();
    const d30ago = new Date(now);
    d30ago.setDate(d30ago.getDate() - 30);
    const d30str = d30ago.toISOString().slice(0, 10);
    const last30 = g.prices.filter((p) => p.date >= d30str);

    const avg30 = last30.length > 0
      ? last30.reduce((s, p) => s + p.price, 0) / last30.length
      : null;
    const max30 = last30.length > 0
      ? Math.max(...last30.map((p) => p.price))
      : null;
    const min30 = last30.length > 0
      ? Math.min(...last30.map((p) => p.price))
      : null;

    // Resolve city info (try city_id first, then fuzzy match by name)
    let cityInfo: CityInfo | undefined;
    if (g.city_id) cityInfo = cityMap.get(g.city_id);
    if (!cityInfo) cityInfo = cityMap.get(g.city_raw.toLowerCase());

    // Resolve commodity info
    let commInfo: CommodityInfo | undefined;
    if (g.commodity_id) commInfo = commMap.get(g.commodity_id);
    if (!commInfo) commInfo = commMap.get(g.commodity_raw.toLowerCase());

    // Auto-categorize if no match
    const rawLower = g.commodity_raw.toLowerCase();
    let autoCategory: "bumbu" | "pokok" | "protein" | null = null;
    if (/cabai|cabe|bawang|jahe|kunyit|lengkuas|merica|lada|kemiri|ketumbar/.test(rawLower)) {
      autoCategory = "bumbu";
    } else if (/beras|gula|minyak|tepung|garam/.test(rawLower)) {
      autoCategory = "pokok";
    } else if (/daging|ayam|telur|telor|ikan|udang|cumi/.test(rawLower)) {
      autoCategory = "protein";
    }

    rows.push({
      // City fields — use real data if available, otherwise derive from city_raw
      kode_wilayah: cityInfo?.kode_wilayah ?? `fb_${g.city_raw.toLowerCase().replace(/\s+/g, "_")}`,
      city_raw: g.city_raw,
      province: cityInfo?.province ?? "—",
      island: cityInfo?.island ?? "Lainnya",
      entity_type: cityInfo?.entity_type ?? null,

      // Commodity fields
      commodity_id: commInfo?.id ?? g.commodity_raw.toLowerCase().replace(/\s+/g, "_"),
      commodity_name: commInfo?.name ?? g.commodity_raw,
      category: commInfo?.category ?? autoCategory,
      unit: commInfo?.unit ?? "kg",

      // Price fields
      price_latest: latest.price,
      price_prev: prev?.price ?? null,
      het_ha: null, // No HET for Facebook data
      date_latest: latest.date,
      date_prev: prev?.date ?? null,

      // 30-day aggregates
      avg_30d: avg30 ? Math.round(avg30) : null,
      max_30d: max30,
      min_30d: min30,
      obs_30d: last30.length,
    });
  }

  return NextResponse.json({ data: rows });
}
