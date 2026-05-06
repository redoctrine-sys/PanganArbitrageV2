/**
 * Test: fetch PIHPS data via JSON API for all 4 price types,
 * then export to a single Excel file (one sheet per price type).
 *
 * Run: npx tsx agents/test-download-all.ts
 * Output: pihps-all-price-types-YYYY-MM-DD.xlsx
 *
 * Date range: set PIHPS_START_DATE / PIHPS_END_DATE in env or .env file.
 * Default: today WIB.
 */

import "dotenv/config";
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga";

const PRICE_TYPES = [
  { id: 1, name: "Pasar Tradisional" },
  { id: 2, name: "Pasar Modern" },
  { id: 3, name: "Pedagang Besar" },
  { id: 4, name: "Produsen" },
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "X-Requested-With": "XMLHttpRequest",
  Connection: "keep-alive",
  Referer: "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RefCommodity {
  id: string;
  name: string;
  cat_id: string | null;
  denomination: string;
}

interface GridRow {
  no: string | number;
  name: string;
  level: number;
  [dateCol: string]: string | number;
}

interface FlatRow {
  Tanggal: string;
  Provinsi: string;
  Komoditas: string;
  "Harga (Rp)": number | null;
  Satuan: string;
  "Jenis Pasar": string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayWIB(): string {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parsePrice(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) && s > 0 ? s : null;
  const n = Number(String(s).replace(/[, ]/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateColToISO(col: string): string | null {
  const m = col.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} → ${url}`);
      const text = await res.text();
      const parsed = JSON.parse(text) as { data: T };
      return parsed.data;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 2000;
      process.stdout.write(`(retry ${attempt}/${retries - 1} after ${delay}ms) `);
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchCommodities(): Promise<RefCommodity[]> {
  const all = await getJson<RefCommodity[]>(
    `${BASE}/GetRefCommodityAndCategory?_=${Date.now()}`,
  );
  return all.filter((r) => r.id.startsWith("com_"));
}

async function fetchGridForPriceType(
  priceTypeId: number,
  comId: string,
  startDate: string,
  endDate: string,
): Promise<GridRow[]> {
  const params = new URLSearchParams({
    price_type_id: String(priceTypeId),
    comcat_id: comId,
    province_id: "",
    regency_id: "",
    showKota: "false",
    showPasar: "false",
    tipe_laporan: "1",
    start_date: startDate,
    end_date: endDate,
    _: String(Date.now()),
  });
  return getJson<GridRow[]>(`${BASE}/GetGridDataKomoditas?${params}`);
}

// ---------------------------------------------------------------------------
// Pivot grid → flat rows
// ---------------------------------------------------------------------------

function pivotToFlat(
  rows: GridRow[],
  commodityName: string,
  denomination: string,
  priceTypeName: string,
): FlatRow[] {
  const out: FlatRow[] = [];
  if (rows.length === 0) return out;
  const dateCols = Object.keys(rows[0]).filter((k) => /^\d{2}\/\d{2}\/\d{4}$/.test(k));

  for (const row of rows) {
    if (row.level !== 1) continue; // level 1 = province, skip national (0) and sub (2)
    const province = String(row.name).trim();
    if (!province || province === "Semua Provinsi") continue;

    for (const col of dateCols) {
      const isoDate = dateColToISO(col);
      if (!isoDate) continue;
      const price = parsePrice(row[col] as string);
      out.push({
        Tanggal: isoDate,
        Provinsi: province,
        Komoditas: commodityName,
        "Harga (Rp)": price,
        Satuan: denomination || "kg",
        "Jenis Pasar": priceTypeName,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build one sheet per price type
// ---------------------------------------------------------------------------

async function fetchAllForPriceType(
  pt: { id: number; name: string },
  commodities: RefCommodity[],
  startDate: string,
  endDate: string,
): Promise<FlatRow[]> {
  const allRows: FlatRow[] = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < commodities.length; i++) {
    const com = commodities[i];
    process.stdout.write(`    [${i + 1}/${commodities.length}] ${com.name} ... `);
    try {
      const grid = await fetchGridForPriceType(pt.id, com.id, startDate, endDate);
      const flat = pivotToFlat(grid, com.name, com.denomination, pt.name);
      allRows.push(...flat);
      process.stdout.write(`${flat.length} rows\n`);
      ok++;
    } catch (err) {
      process.stdout.write(`✗ ${(err as Error).message}\n`);
      fail++;
    }
    await sleep(300);
  }

  console.log(`  → total: ${allRows.length} rows (${ok} ok, ${fail} fail)`);
  return allRows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const endDate = process.env.PIHPS_END_DATE ?? todayWIB();
  const startDate =
    process.env.PIHPS_START_DATE ??
    new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  console.log(`=== PIHPS All Price Types Download Test ===`);
  console.log(`Date range: ${startDate} → ${endDate}`);
  console.log(`Fetching commodity list...`);

  const commodities = await fetchCommodities();
  console.log(`Found ${commodities.length} commodities.\n`);

  const wb = XLSX.utils.book_new();
  const summary: { priceType: string; rows: number }[] = [];

  for (const pt of PRICE_TYPES) {
    console.log(`\n[${pt.id}/4] ${pt.name}`);
    const rows = await fetchAllForPriceType(pt, commodities, startDate, endDate);
    summary.push({ priceType: pt.name, rows: rows.length });

    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, // Tanggal
        { wch: 25 }, // Provinsi
        { wch: 35 }, // Komoditas
        { wch: 14 }, // Harga
        { wch: 8 },  // Satuan
        { wch: 22 }, // Jenis Pasar
      ];
      // Sheet name max 31 chars
      XLSX.utils.book_append_sheet(wb, ws, pt.name.slice(0, 31));
    }
  }

  // Summary sheet
  const summaryWs = XLSX.utils.json_to_sheet(
    summary.map((s, i) => ({
      No: i + 1,
      "Jenis Pasar": s.priceType,
      "Jumlah Baris": s.rows,
      "Tanggal Mulai": startDate,
      "Tanggal Selesai": endDate,
      "Diunduh": new Date().toISOString(),
    })),
  );
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  const outFile = `pihps-all-${startDate}-to-${endDate}.xlsx`;
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(outFile, buf);

  console.log(`\n=== Selesai ===`);
  console.log(`File: ${outFile}`);
  for (const s of summary) {
    console.log(`  ${s.priceType}: ${s.rows} baris`);
  }
  console.log(`Total: ${summary.reduce((a, s) => a + s.rows, 0)} baris`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
