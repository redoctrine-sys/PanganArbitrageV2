/**
 * PIHPS Scraper v4 — HTTP-first, Excel download preferred
 *
 * Two modes (controlled by PIHPS_MODE env):
 *
 *   "download" (default) — try BI's bulk Excel export endpoint first.
 *     One request per (category × price_type) → XLSX binary → parse → upsert.
 *     Fast: ~10 calls × <1 sec each. Requires PIHPS_DOWNLOAD_ENDPOINT confirmed
 *     via `npm run probe:download`. Falls back to "json" on any HTTP error.
 *
 *   "json" — direct JSON grid API (proven, v3 behaviour).
 *     GET /GetGridDataKomoditas per category, pivot province rows.
 *
 * Env:
 *   PIHPS_MODE            "download" | "json"  (default: "download")
 *   PIHPS_DOWNLOAD_ENDPOINT  full URL of BI's Excel export endpoint
 *                            (run probe:download to confirm, then set here)
 *   PIHPS_START_DATE      YYYY-MM-DD (default: today WIB)
 *   PIHPS_END_DATE        YYYY-MM-DD (default: today WIB)
 *   PIHPS_PRICE_TYPE      unset/"all" = run all 4 types (default).
 *                         "1"=Pasar Tradisional, "2"=Pasar Modern,
 *                         "3"=Pedagang Besar, "4"=Produsen.
 *                         Comma-separated for subset: "1,3"
 *   PIHPS_REGENCY         0=disable regency drill (default: ON — set to 0 to skip)
 *   PIHPS_INCLUDE_PROVINCE 1=also store province-level rows when regency drill is ON
 *   PIHPS_PROVINCE_FILTER comma-separated province IDs (regency drill scope)
 *   PIHPS_CONCURRENCY     max parallel requests in regency drill (default: 5)
 *
 * Performance (json mode):
 *   Province-only (PIHPS_REGENCY=0): ~10 calls × ~500ms = ~5 sec
 *   Regency drill concurrency=5: 340 tasks ÷ 5 = ~34s per price type
 *   All 4 types with regency drill: ~2–3 min total
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { upsertPrices } from "../shared/supabase";
import { startRun, finishRun, log, debug } from "../shared/logger";
import type { ScrapedPrice, ScrapeRunResult } from "../shared/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga";
const REFERER =
  "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
  Referer: REFERER,
};

const DOWNLOAD_HEADERS = {
  ...HEADERS,
  Accept:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*",
};

const PRICE_TYPE_NAMES: Record<number, string> = {
  1: "Pasar Tradisional",
  2: "Pasar Modern",
  3: "Pedagang Besar",
  4: "Produsen",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RefCommodityRow {
  id: string;
  name: string;
  cat_id: string | null;
  denomination: string;
  sort: number;
}

interface RefProvinceRow {
  id: number;
  name: string;
}

interface GridRow {
  no: string | number;
  name: string;
  level: number;
  [dateCol: string]: string | number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayWIB(): string {
  const now = new Date();
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

/** Parse "15,150" or "1,234,567" or "" → number | null */
function parsePrice(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) && s > 0 ? s : null;
  const cleaned = String(s).replace(/[, ]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Run `fns` with at most `concurrency` in-flight at once.
 * Returns results in original order as PromiseSettledResult[].
 */
async function pLimit<T>(
  fns: Array<() => Promise<T>>,
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = Array(fns.length);
  let next = 0;
  async function worker() {
    let idx: number;
    while ((idx = next++) < fns.length) {
      try {
        results[idx] = { status: "fulfilled", value: await fns[idx]() };
      } catch (e) {
        results[idx] = { status: "rejected", reason: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, fns.length) }, worker));
  return results;
}

/** "DD/MM/YYYY" → "YYYY-MM-DD" */
function dateColToISO(col: string): string | null {
  const m = col.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Invalid JSON from ${url}: ${(err as Error).message}\nFirst 200: ${text.slice(0, 200)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
    throw new Error(`Missing 'data' field in response from ${url}`);
  }
  return (parsed as { data: T }).data;
}

async function fetchCommodities(): Promise<RefCommodityRow[]> {
  const all = await getJson<RefCommodityRow[]>(
    `${BASE}/GetRefCommodityAndCategory?_=${Date.now()}`,
  );
  return all.filter((r) => r.id.startsWith("com_"));
}

async function fetchProvinces(): Promise<RefProvinceRow[]> {
  return getJson<RefProvinceRow[]>(`${BASE}/GetRefProvince?_=${Date.now()}`);
}

// ---------------------------------------------------------------------------
// MODE A: Excel download
// ---------------------------------------------------------------------------

/**
 * Download Excel from BI's bulk export endpoint.
 * Returns ArrayBuffer on success; throws on failure.
 *
 * Set PIHPS_DOWNLOAD_ENDPOINT after confirming via `npm run probe:download`.
 * Common candidates:
 *   /WebSite/TabelHarga/DownloadDataKomoditas
 *   /WebSite/TabelHarga/ExportExcel
 *   /WebSite/TabelHarga/DownloadExcel
 */
async function fetchExcelBinary(
  endpointUrl: string,
  params: URLSearchParams,
): Promise<ArrayBuffer> {
  const url = `${endpointUrl}?${params.toString()}`;
  const res = await fetch(url, { headers: DOWNLOAD_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);

  const ct = res.headers.get("content-type") ?? "";
  if (
    !ct.includes("excel") &&
    !ct.includes("spreadsheet") &&
    !ct.includes("octet-stream") &&
    !ct.includes("csv")
  ) {
    const preview = await res.text();
    throw new Error(
      `Expected binary/Excel, got content-type="${ct}". Preview: ${preview.slice(0, 200)}`,
    );
  }

  return res.arrayBuffer();
}

/**
 * Parse an XLSX binary into ScrapedPrice rows.
 *
 * Expected sheet columns (BI export format — verify after running probe):
 *   Tanggal | Provinsi | Komoditas | Harga | Satuan
 * OR wide pivot format similar to GetGridDataKomoditas.
 *
 * This parser handles both layouts:
 *   - Flat (long) format: date + location + commodity + price columns
 *   - Wide (pivot) format: first col = location, remaining cols = dates
 */
function parseExcelToScrapedPrices(
  buf: ArrayBuffer,
  priceTypeName: string,
  commodityHint?: string,
): ScrapedPrice[] {
  const wb = XLSX.read(buf, { type: "array" });
  const out: ScrapedPrice[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
    });

    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0]);

    // Detect layout: flat vs wide-pivot
    const hasDateCol = headers.some((h) => /tanggal|date/i.test(h));
    const hasCityCol = headers.some((h) =>
      /provinsi|kota|kabupaten|region|wilayah/i.test(h),
    );
    const hasHargaCol = headers.some((h) => /harga|price|nilai/i.test(h));
    const hasCommodityCol = headers.some((h) =>
      /komoditas|commodity|barang/i.test(h),
    );
    void hasCommodityCol;

    const isFlat = hasDateCol && (hasCityCol || hasHargaCol);
    const isWidePivot = !isFlat && headers.some((h) => /^\d{2}\/\d{2}\/\d{4}$/.test(h));

    if (isFlat) {
      const dateKey = headers.find((h) => /tanggal|date/i.test(h))!;
      const cityKey = headers.find((h) => /provinsi|kota|kabupaten|region|wilayah/i.test(h));
      const hargaKey = headers.find((h) => /harga|price|nilai/i.test(h))!;
      const commodityKey = headers.find((h) => /komoditas|commodity|barang/i.test(h));
      const unitKey = headers.find((h) => /satuan|unit/i.test(h));

      for (const row of rows) {
        const rawDate = String(row[dateKey] ?? "").trim();
        const isoDate = dateColToISO(rawDate) ?? rawDate.slice(0, 10);
        if (!isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

        const cityRaw = cityKey
          ? String(row[cityKey] ?? "").trim()
          : "Unknown";
        const commodityRaw = commodityKey
          ? String(row[commodityKey] ?? "").trim()
          : (commodityHint ?? "Unknown");
        const price = parsePrice(row[hargaKey] as string);
        if (price == null || !cityRaw) continue;

        out.push({
          source: "pihps",
          city_raw: cityRaw,
          commodity_raw: commodityRaw,
          price,
          unit: unitKey ? String(row[unitKey] ?? "kg") : "kg",
          date: isoDate,
          confidence: 1.0,
          market_name: priceTypeName,
        });
      }
    } else if (isWidePivot) {
      const dateCols = headers.filter((h) => /^\d{2}\/\d{2}\/\d{4}$/.test(h));
      const nameKey = headers[0];

      for (const row of rows) {
        const cityRaw = String(row[nameKey] ?? "").trim();
        if (!cityRaw || cityRaw === "Semua Provinsi") continue;

        for (const col of dateCols) {
          const isoDate = dateColToISO(col);
          if (!isoDate) continue;
          const price = parsePrice(row[col] as string);
          if (price == null) continue;
          out.push({
            source: "pihps",
            city_raw: cityRaw,
            commodity_raw: commodityHint ?? sheetName,
            price,
            unit: "kg",
            date: isoDate,
            confidence: 1.0,
            market_name: priceTypeName,
          });
        }
      }
    } else {
      debug(`Sheet "${sheetName}": unrecognised layout (headers: ${headers.slice(0, 8).join(", ")})`);
    }
  }

  return out;
}

async function runDownloadMode(
  downloadEndpoint: string,
  commodities: RefCommodityRow[],
  priceTypeId: number,
  priceTypeName: string,
  startDate: string,
  endDate: string,
  isDebug: boolean,
): Promise<{ prices: ScrapedPrice[]; errors: string[] }> {
  const prices: ScrapedPrice[] = [];
  const errors: string[] = [];

  for (let i = 0; i < commodities.length; i++) {
    const com = commodities[i];
    log(`[${i + 1}/${commodities.length}] download: ${com.name} (${com.id})`);

    const params = new URLSearchParams({
      price_type_id: String(priceTypeId),
      comcat_id: com.id,
      province_id: "",
      regency_id: "",
      showKota: "false",
      showPasar: "false",
      tipe_laporan: "1",
      start_date: startDate,
      end_date: endDate,
      _: String(Date.now()),
    });

    try {
      const buf = await fetchExcelBinary(downloadEndpoint, params);

      if (isDebug) {
        writeFileSync(
          `debug-pihps-download-${com.id}.xlsx`,
          Buffer.from(buf),
        );
      }

      const parsed = parseExcelToScrapedPrices(buf, priceTypeName, com.name);
      log(`  → ${parsed.length} prices`);
      prices.push(...parsed);
    } catch (err) {
      const msg = (err as Error).message;
      log(`  ✗ ${msg}`);
      errors.push(`download/${com.id}: ${msg}`);
    }
  }

  return { prices, errors };
}

// ---------------------------------------------------------------------------
// MODE B: JSON grid (proven v3 behaviour)
// ---------------------------------------------------------------------------

interface GridQuery {
  priceTypeId: number;
  catId: string;
  startDate: string;
  endDate: string;
  provinceId?: number;
  showKota?: boolean;
}

async function fetchGrid(q: GridQuery): Promise<GridRow[]> {
  const params = new URLSearchParams({
    price_type_id: String(q.priceTypeId),
    comcat_id: q.catId,
    province_id: q.provinceId != null ? String(q.provinceId) : "",
    regency_id: "",
    showKota: String(q.showKota ?? false),
    showPasar: "false",
    tipe_laporan: "1",
    start_date: q.startDate,
    end_date: q.endDate,
    _: String(Date.now()),
  });
  return getJson<GridRow[]>(`${BASE}/GetGridDataKomoditas?${params.toString()}`);
}

function pivotProvinceGrid(
  rows: GridRow[],
  category: RefCommodityRow,
  priceTypeName: string,
): ScrapedPrice[] {
  const out: ScrapedPrice[] = [];
  const dateCols = Object.keys(rows[0] ?? {}).filter((k) =>
    /^\d{2}\/\d{2}\/\d{4}$/.test(k),
  );

  for (const row of rows) {
    if (row.level !== 1) continue;
    const cityRaw = String(row.name).trim();
    if (!cityRaw || cityRaw === "Semua Provinsi") continue;

    for (const col of dateCols) {
      const isoDate = dateColToISO(col);
      if (!isoDate) continue;
      const price = parsePrice(row[col] as string);
      if (price == null) continue;
      out.push({
        source: "pihps",
        city_raw: cityRaw,
        commodity_raw: category.name,
        price,
        unit: category.denomination || "kg",
        date: isoDate,
        confidence: 1.0,
        market_name: priceTypeName,
      });
    }
  }
  return out;
}

function pivotRegencyGrid(
  rows: GridRow[],
  category: RefCommodityRow,
  _province: RefProvinceRow,
  priceTypeName: string,
): ScrapedPrice[] {
  const out: ScrapedPrice[] = [];
  const dateCols = Object.keys(rows[0] ?? {}).filter((k) =>
    /^\d{2}\/\d{2}\/\d{4}$/.test(k),
  );

  for (const row of rows) {
    if (row.level !== 2) continue;
    const cityRaw = String(row.name).trim();
    if (!cityRaw) continue;

    for (const col of dateCols) {
      const isoDate = dateColToISO(col);
      if (!isoDate) continue;
      const price = parsePrice(row[col] as string);
      if (price == null) continue;
      out.push({
        source: "pihps",
        city_raw: cityRaw,
        commodity_raw: category.name,
        price,
        unit: category.denomination || "kg",
        date: isoDate,
        confidence: 1.0,
        market_name: priceTypeName,
      });
    }
  }
  return out;
}

async function runJsonMode(
  commodities: RefCommodityRow[],
  provinces: RefProvinceRow[],
  priceTypeId: number,
  priceTypeName: string,
  startDate: string,
  endDate: string,
  regencyDrill: boolean,
  provinceFilter: number[],
  concurrency: number,
): Promise<{ prices: ScrapedPrice[]; errors: string[] }> {
  const prices: ScrapedPrice[] = [];
  const errors: string[] = [];

  // Skip province-level when regency drill is on — province aggregates would
  // pollute city_raw with province names alongside actual kota/kabupaten names.
  // Set PIHPS_INCLUDE_PROVINCE=1 to store both levels.
  const includeProvince = !regencyDrill || process.env.PIHPS_INCLUDE_PROVINCE === "1";

  if (includeProvince) {
    log(`\n=== Province-level scrape (${commodities.length} commodities) ===`);
    for (let i = 0; i < commodities.length; i++) {
      const com = commodities[i];
      log(`[${i + 1}/${commodities.length}] ${com.name} (${com.id})`);
      try {
        const rows = await fetchGrid({
          priceTypeId,
          catId: com.id,
          startDate,
          endDate,
          showKota: false,
        });
        const p = pivotProvinceGrid(rows, com, priceTypeName);
        log(`  → ${p.length} prices`);
        prices.push(...p);
      } catch (err) {
        log(`  ✗ ${(err as Error).message}`);
        errors.push(`province/${com.id}: ${(err as Error).message}`);
      }
    }
  }

  if (regencyDrill) {
    const targets =
      provinceFilter.length > 0
        ? provinces.filter((p) => provinceFilter.includes(p.id))
        : provinces;
    const totalTasks = targets.length * commodities.length;
    log(
      `\n=== Regency drill (${targets.length} prov × ${commodities.length} com = ${totalTasks} calls, concurrency=${concurrency}) ===`,
    );

    // Build flat task list then run with capped concurrency
    type TaskResult = { prov: RefProvinceRow; com: RefCommodityRow; p: ScrapedPrice[] };
    const tasks: Array<() => Promise<TaskResult>> = [];
    for (const prov of targets) {
      for (const com of commodities) {
        tasks.push(async () => {
          const rows = await fetchGrid({
            priceTypeId,
            catId: com.id,
            startDate,
            endDate,
            provinceId: prov.id,
            showKota: true,
          });
          return { prov, com, p: pivotRegencyGrid(rows, com, prov, priceTypeName) };
        });
      }
    }

    const settled = await pLimit(tasks, concurrency);
    let regencyTotal = 0;
    for (const r of settled) {
      if (r.status === "fulfilled") {
        prices.push(...r.value.p);
        regencyTotal += r.value.p.length;
      } else {
        const err = r.reason as Error;
        debug(`  ✗ regency task: ${err.message}`);
        errors.push(`regency: ${err.message}`);
      }
    }
    log(`  → ${regencyTotal} total regency prices (${settled.filter(r => r.status === "rejected").length} errors)`);
  }

  return { prices, errors };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Excel backup
// ---------------------------------------------------------------------------

/**
 * Save allPrices as a local XLSX backup before upsert.
 * Enabled when PIHPS_BACKUP_EXCEL=1.
 * One sheet per price type; sheet name = market_name.
 * Output dir: PIHPS_BACKUP_DIR (default: ./backups).
 * File: pihps-backup-YYYY-MM-DD_to_YYYY-MM-DD.xlsx
 */
function saveExcelBackup(
  prices: ScrapedPrice[],
  startDate: string,
  endDate: string,
): string {
  const dir = process.env.PIHPS_BACKUP_DIR ?? "./backups";
  mkdirSync(dir, { recursive: true });

  const wb = XLSX.utils.book_new();

  // Group by market_name → one sheet per price type
  const byType = new Map<string, ScrapedPrice[]>();
  for (const p of prices) {
    const key = p.market_name ?? "Unknown";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(p);
  }

  for (const [typeName, rows] of byType) {
    const sheet = rows.map((r) => ({
      Tanggal: r.date,
      "Provinsi/Kota": r.city_raw,
      Komoditas: r.commodity_raw,
      "Harga (Rp)": r.price,
      Satuan: r.unit,
      "Jenis Pasar": typeName,
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 35 }, { wch: 14 }, { wch: 8 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, typeName.slice(0, 31));
  }

  // Summary sheet
  const summaryRows = Array.from(byType.entries()).map(([name, rows]) => ({
    "Jenis Pasar": name,
    "Jumlah Baris": rows.length,
    "Tanggal Mulai": startDate,
    "Tanggal Selesai": endDate,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Ringkasan");

  const fname = join(dir, `pihps-backup-${startDate}_to_${endDate}.xlsx`);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(fname, buf);
  return fname;
}

// ---------------------------------------------------------------------------

/**
 * Parse PIHPS_PRICE_TYPE env into a list of price type IDs to run.
 *   unset / empty / "all"  → [1, 2, 3, 4]  (all types)
 *   "1"                    → [1]
 *   "1,3"                  → [1, 3]
 */
function parsePriceTypes(): number[] {
  const raw = (process.env.PIHPS_PRICE_TYPE ?? "").trim();
  if (!raw || raw === "all") return [1, 2, 3, 4];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n >= 1 && n <= 4);
}

async function run(): Promise<ScrapeRunResult> {
  const startedAt = Date.now();
  const isDebug = process.env.DEBUG === "1";

  // Validate required credentials early — fail fast with actionable message
  const missingEnv: string[] = [];
  if (!process.env.SUPABASE_URL) missingEnv.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missingEnv.length > 0) {
    throw new Error(
      `Missing required env vars: ${missingEnv.join(", ")}. ` +
      `Jika berjalan di GitHub Actions: tambahkan secrets di ` +
      `GitHub repo → Settings → Secrets and variables → Actions. ` +
      `Jika lokal: pastikan .env sudah terisi dan diload via dotenv.`,
    );
  }

  const mode = (process.env.PIHPS_MODE ?? "json").toLowerCase() as
    | "download"
    | "json";
  const downloadEndpoint =
    process.env.PIHPS_DOWNLOAD_ENDPOINT ?? `${BASE}/DownloadDataKomoditas`;

  // Use || not ?? — GitHub Actions sends "" for unset workflow_dispatch inputs
  const startDate = process.env.PIHPS_START_DATE || todayWIB();
  const endDate = process.env.PIHPS_END_DATE || todayWIB();
  const priceTypeIds = parsePriceTypes();
  // Regency drill default ON — opt-out via PIHPS_REGENCY=0
  const regencyDrill = process.env.PIHPS_REGENCY !== "0";
  // Concurrent requests for regency drill — default 5, set PIHPS_CONCURRENCY to tune
  const concurrency = Math.max(1, Number(process.env.PIHPS_CONCURRENCY || "5"));
  const provinceFilter = (process.env.PIHPS_PROVINCE_FILTER ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  log(`Mode: ${mode}`);
  log(`Date range: ${startDate} → ${endDate}`);
  log(`Price types: ${priceTypeIds.map((id) => `${id}=${PRICE_TYPE_NAMES[id]}`).join(", ")}`);
  if (mode === "json") {
    log(`Regency drill: ${regencyDrill ? `ON (concurrency=${concurrency})` : "off"}`);
    if (provinceFilter.length > 0) log(`Province filter: ${provinceFilter.join(",")}`);
  }

  const [commodities, provinces] = await Promise.all([
    fetchCommodities(),
    fetchProvinces(),
  ]);
  log(`Commodities: ${commodities.length}, Provinces: ${provinces.length}`);

  if (isDebug) {
    writeFileSync("debug-pihps-commodities.json", JSON.stringify(commodities, null, 2));
    writeFileSync("debug-pihps-provinces.json", JSON.stringify(provinces, null, 2));
  }

  const allPrices: ScrapedPrice[] = [];
  const allErrors: string[] = [];
  const perTypeStats: Record<string, number> = {};

  // Loop all requested price types
  for (const ptId of priceTypeIds) {
    const ptName = PRICE_TYPE_NAMES[ptId] ?? "Unknown";
    log(`\n${"=".repeat(60)}`);
    log(`Price type ${ptId}: ${ptName}`);
    log("=".repeat(60));

    let prices: ScrapedPrice[] = [];
    let errors: string[] = [];
    let effectiveMode = mode;

    if (mode === "download") {
      const result = await runDownloadMode(
        downloadEndpoint,
        commodities,
        ptId,
        ptName,
        startDate,
        endDate,
        isDebug,
      );
      prices = result.prices;
      errors = result.errors;

      if (prices.length === 0 && errors.length > 0) {
        log(`Download failed (${errors.length} errors). Falling back to JSON.`);
        effectiveMode = "json";
        errors = [];
      }
    }

    if (effectiveMode === "json") {
      const result = await runJsonMode(
        commodities,
        provinces,
        ptId,
        ptName,
        startDate,
        endDate,
        regencyDrill,
        provinceFilter,
        concurrency,
      );
      prices = result.prices;
      errors = result.errors;
    }

    allPrices.push(...prices);
    allErrors.push(...errors);
    perTypeStats[ptName] = prices.length;
    log(`Price type ${ptId} done: ${prices.length} prices, ${errors.length} errors`);
  }

  if (allPrices.length === 0) {
    return {
      source: "pihps",
      status: "failed",
      rows_scraped: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - startedAt,
      error_message: allErrors.join("; ") || "No prices extracted",
    };
  }

  // Optional local Excel backup (PIHPS_BACKUP_EXCEL=1)
  if (process.env.PIHPS_BACKUP_EXCEL === "1") {
    try {
      const fname = saveExcelBackup(allPrices, startDate, endDate);
      log(`Backup saved: ${fname} (${allPrices.length} rows)`);
    } catch (err) {
      log(`WARNING: backup failed: ${(err as Error).message}`);
    }
  }

  log(`\nUpserting ${allPrices.length} total prices to prices_raw...`);
  const stats = await upsertPrices(allPrices);
  log(`✓ inserted=${stats.inserted}, updated=${stats.updated}, skipped=${stats.skipped}`);

  return {
    source: "pihps",
    status: allErrors.length === 0 ? "success" : "partial",
    rows_scraped: allPrices.length,
    rows_inserted: stats.inserted,
    rows_updated: stats.updated,
    rows_skipped: stats.skipped,
    duration_ms: Date.now() - startedAt,
    metadata: {
      mode,
      start_date: startDate,
      end_date: endDate,
      price_types: priceTypeIds,
      per_type: perTypeStats,
      regency_drill: regencyDrill,
      commodities: commodities.length,
      provinces: provinces.length,
      error_count: allErrors.length,
      backup_excel: process.env.PIHPS_BACKUP_EXCEL === "1",
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log("=== PIHPS Scraper Start (v5 — all price types) ===");
  let runId: string | null = null;
  try {
    runId = await startRun("pihps", { version: "v4", endpoint: BASE });
  } catch (err) {
    log("WARNING: failed to start run log:", (err as Error).message);
  }

  let result: ScrapeRunResult;
  try {
    result = await run();
  } catch (err) {
    result = {
      source: "pihps",
      status: "failed",
      rows_scraped: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: 0,
      error_message: (err as Error).message,
    };
    log("✗ Run failed:", (err as Error).message);
  }

  if (runId) await finishRun(runId, result);

  log(`=== PIHPS Scraper End [${result.status}] ===`);
  log(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
  if (result.error_message) log(`Error: ${result.error_message}`);
  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
