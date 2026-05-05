/**
 * PIHPS Scraper — Bank Indonesia (bi.go.id/hargapangan)
 *
 * Page structure (per commodity):
 *   <li class="pricelist" onclick="openDetailCom(N, 'COMMODITY NAME', ...)">
 *     <div id="harga_info_N">Rp 48.450 PER kg ...</div>
 *   </li>
 *
 * v2 Strategy: iterate provinces via #cboProvince DevExtreme dropdown.
 *   1. Load page, wait for hydration
 *   2. Read province list from dxSelectBox dataSource
 *   3. For each province:
 *      a. Set dropdown value via dxSelectBox API
 *      b. Wait for harga_info_* widgets to refresh
 *      c. Extract prices via DOM walk
 *   4. Bulk upsert to prices_raw (source: 'pihps')
 *
 * Env:
 *   PIHPS_PROVINCE_LIMIT=N  → only first N provinces (testing)
 *   PIHPS_INCLUDE_NATIONAL=1 → also scrape value=0 (Semua Provinsi)
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { launchBrowser } from "../shared/browser";
import { upsertPrices } from "../shared/supabase";
import { startRun, finishRun, log } from "../shared/logger";
import type { ScrapedPrice, ScrapeRunResult } from "../shared/types";

const PIHPS_URL = "https://www.bi.go.id/hargapangan";
const PAGE_TIMEOUT_MS = 60_000;
const HYDRATE_WAIT_MS = 8_000;
const PER_PROVINCE_REFRESH_MS = 3_500;
const RELOAD_EVERY_N_PROVINCES = 5;  // Reload page periodically to avoid memory bloat / browser crash

function todayWIB(): string {
  const now = new Date();
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 10);
}

interface RawPriceItem {
  commodity_id_dom: string;
  commodity_name: string;
  price_text: string;
  unit_text: string;
}

interface ProvinceOpt {
  province_id: number;
  province_name: string;
}

declare global {
  interface Window {
    DevExpress?: unknown;
    jQuery?: unknown;
    $?: unknown;
  }
}

/** Read province list from the DevExtreme dropdown's dataSource. */
async function getProvinceList(page: import("playwright").Page): Promise<ProvinceOpt[]> {
  return await page.evaluate(async () => {
    const w = window as unknown as { $?: (sel: string) => { dxSelectBox: (k: string) => unknown }; jQuery?: typeof w.$ };
    const $ = w.$ ?? w.jQuery;
    if (!$) return [];
    const inst = $("#cboProvince").dxSelectBox("instance") as { getDataSource: () => { load: () => Promise<unknown>; items: () => unknown[] } } | null;
    if (!inst) return [];
    const ds = inst.getDataSource();
    await ds.load();
    const items = ds.items() as Array<{ province_id: number; province_name: string }>;
    return items.map((i) => ({ province_id: i.province_id, province_name: i.province_name }));
  });
}

/** Set active province via dxSelectBox API. */
async function selectProvince(page: import("playwright").Page, provinceId: number): Promise<void> {
  await page.evaluate((id) => {
    const w = window as unknown as { $?: (sel: string) => { dxSelectBox: (k: string) => { option: (k: string, v: number) => void } }; jQuery?: typeof w.$ };
    const $ = w.$ ?? w.jQuery;
    if (!$) return;
    $("#cboProvince").dxSelectBox("instance").option("value", id);
  }, provinceId);
}

async function extractPriceList(page: import("playwright").Page): Promise<RawPriceItem[]> {
  return await page.evaluate(() => {
    const items: RawPriceItem[] = [];
    const lis = document.querySelectorAll("li.pricelist");
    for (const li of Array.from(lis)) {
      const onclick = li.getAttribute("onclick") ?? "";
      const m = onclick.match(/openDetailCom\(\s*(\d+)\s*,\s*['"]([^'"]+)['"]/);
      if (!m) continue;
      const [, idStr, name] = m;
      const widget = li.querySelector(`#harga_info_${idStr}`);
      if (!widget) continue;
      const text = (widget as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      const priceMatch = text.match(/Rp\s+([\d.,-]+)/);
      const unitMatch = text.match(/PER\s+(\w+)/i);
      items.push({
        commodity_id_dom: idStr,
        commodity_name: name,
        price_text: priceMatch?.[1] ?? "",
        unit_text: unitMatch?.[1] ?? "kg",
      });
    }
    return items;
  });
}

function parseRupiah(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function run(): Promise<ScrapeRunResult> {
  const startedAt = Date.now();
  const date = todayWIB();
  const isDebug = process.env.DEBUG === "1";
  const provinceLimit = Number(process.env.PIHPS_PROVINCE_LIMIT ?? "0");
  const includeNational = process.env.PIHPS_INCLUDE_NATIONAL === "1";

  const session = await launchBrowser({ headless: !isDebug });
  const allPrices: ScrapedPrice[] = [];
  const failedProvinces: string[] = [];
  let provinces: ProvinceOpt[] = [];

  try {
    log(`Loading ${PIHPS_URL}`);
    await session.page.goto(PIHPS_URL, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });
    log(`Waiting ${HYDRATE_WAIT_MS}ms for DevExtreme hydration...`);
    await session.page.waitForTimeout(HYDRATE_WAIT_MS);
    await session.page
      .waitForFunction(() => document.querySelectorAll("li.pricelist").length > 0, { timeout: 15_000 })
      .catch(() => log("⚠ Timeout waiting for li.pricelist"));

    provinces = await getProvinceList(session.page);
    // Filter: drop province_id=0 (Semua Provinsi) unless includeNational set
    const targets = provinces
      .filter((p) => includeNational || p.province_id !== 0)
      .slice(0, provinceLimit > 0 ? provinceLimit : undefined);

    log(`Province list: ${provinces.length} total, ${targets.length} targets`);
    if (isDebug) writeFileSync("debug-pihps-provinces.json", JSON.stringify(provinces, null, 2));

    for (let i = 0; i < targets.length; i++) {
      const prov = targets[i];
      log(`[${i + 1}/${targets.length}] ${prov.province_name} (id=${prov.province_id})`);

      // Periodic page reload to prevent memory bloat / browser crash on long runs
      if (i > 0 && i % RELOAD_EVERY_N_PROVINCES === 0) {
        log(`  ↻ Reloading page (every ${RELOAD_EVERY_N_PROVINCES} provinces)...`);
        try {
          await session.page.goto(PIHPS_URL, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
          await session.page.waitForTimeout(HYDRATE_WAIT_MS);
          await session.page
            .waitForFunction(() => document.querySelectorAll("li.pricelist").length > 0, { timeout: 15_000 })
            .catch(() => {});
        } catch (err) {
          log(`  ✗ reload failed: ${(err as Error).message}`);
          failedProvinces.push(prov.province_name);
          continue;
        }
      }

      try {
        await selectProvince(session.page, prov.province_id);
        await session.page.waitForTimeout(PER_PROVINCE_REFRESH_MS);

        const items = await extractPriceList(session.page);
        let valid = 0;
        for (const it of items) {
          const price = parseRupiah(it.price_text);
          if (price == null) continue;
          allPrices.push({
            source: "pihps",
            city_raw: prov.province_name,
            commodity_raw: it.commodity_name,
            price,
            unit: "kg",
            date,
            confidence: 1.0,
            original_unit: it.unit_text,
          });
          valid++;
        }
        log(`  → ${valid}/${items.length} valid prices`);
      } catch (err) {
        log(`  ✗ failed: ${(err as Error).message}`);
        failedProvinces.push(prov.province_name);
      }
    }
  } finally {
    await session.close();
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
      error_message: "No prices extracted across all provinces",
      metadata: { failed_provinces: failedProvinces },
    };
  }

  log(`Upserting ${allPrices.length} prices to prices_raw...`);
  const stats = await upsertPrices(allPrices);
  log(`✓ Upserted: inserted=${stats.inserted}, updated=${stats.updated}, skipped=${stats.skipped}`);

  return {
    source: "pihps",
    status: failedProvinces.length === 0 ? "success" : "partial",
    rows_scraped: allPrices.length,
    rows_inserted: stats.inserted,
    rows_updated: stats.updated,
    rows_skipped: stats.skipped,
    duration_ms: Date.now() - startedAt,
    metadata: {
      date,
      provinces_total: provinces.length,
      provinces_failed: failedProvinces,
    },
  };
}

async function main(): Promise<void> {
  log("=== PIHPS Scraper Start (v2 multi-province) ===");
  let runId: string | null = null;
  try {
    runId = await startRun("pihps", { url: PIHPS_URL, version: "v2" });
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
