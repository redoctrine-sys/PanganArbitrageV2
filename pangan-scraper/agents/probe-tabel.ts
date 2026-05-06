/**
 * Probe TabelHarga pages — capture XHR/AJAX endpoints they call.
 * These pages likely have bulk-data endpoints (full table per query).
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { launchBrowser } from "../shared/browser";

const PAGES = [
  "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalDaerah",
  "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
  "https://www.bi.go.id/hargapangan/TabelHarga/PedagangBesarDaerah",
];

async function main(): Promise<void> {
  const session = await launchBrowser({ headless: true });
  const captured: Array<{
    page: string;
    url: string;
    method: string;
    postData?: string;
    status: number;
    contentType: string;
    bodySnippet: string;
  }> = [];

  session.page.on("response", async (resp) => {
    const url = resp.url();
    if (
      url.includes("/hargapangan/") &&
      !url.endsWith(".css") &&
      !url.endsWith(".js") &&
      !url.endsWith(".png") &&
      !url.endsWith(".woff") &&
      !url.endsWith(".woff2") &&
      !url.endsWith(".ttf") &&
      resp.request().resourceType() !== "image"
    ) {
      const contentType = resp.headers()["content-type"] ?? "";
      if (
        contentType.includes("json") ||
        contentType.includes("excel") ||
        contentType.includes("csv") ||
        contentType.includes("octet-stream")
      ) {
        const body = await resp.text().catch(() => "");
        captured.push({
          page: session.page.url(),
          url,
          method: resp.request().method(),
          postData: resp.request().postData() ?? undefined,
          status: resp.status(),
          contentType,
          bodySnippet: body.slice(0, 800),
        });
        console.log(`📡 ${resp.request().method()} ${url.slice(0, 120)} → ${resp.status()} (${contentType})`);
      }
    }
  });

  try {
    for (const pageUrl of PAGES) {
      console.log(`\n=== ${pageUrl} ===`);
      await session.page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await session.page.waitForTimeout(8000);

      // Try clicking "Tampilkan" / submit button if exists
      const buttonClicked = await session.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, .dx-button, a.btn"));
        for (const b of buttons) {
          const text = (b as HTMLElement).innerText?.toLowerCase() ?? "";
          if (text.includes("tampilkan") || text.includes("cari") || text.includes("submit")) {
            (b as HTMLElement).click();
            return text;
          }
        }
        return null;
      });
      if (buttonClicked) {
        console.log(`  Clicked: "${buttonClicked}"`);
        await session.page.waitForTimeout(5000);
      }

      // Look for data grids and inspect their dataSource URLs
      const gridInfo = await session.page.evaluate(() => {
        const w = window as unknown as { $?: (s: string) => { dxDataGrid?: (k: string) => { option?: (k: string) => unknown } } };
        const $ = w.$;
        if (!$) return [];
        const gridEls = Array.from(document.querySelectorAll('[id^="grid"], .dx-datagrid'));
        const out: Array<{ id: string; storeUrl?: string }> = [];
        for (const el of gridEls) {
          const id = el.id;
          if (!id) continue;
          try {
            const inst = $("#" + id).dxDataGrid?.("instance") as { option?: (k: string) => unknown } | undefined;
            if (inst?.option) {
              const ds = inst.option("dataSource") as { store?: { _loadUrl?: string; _store?: { _loadUrl?: string } } } | undefined;
              const storeUrl =
                (ds?.store?._loadUrl as string | undefined) ??
                (ds?.store?._store?._loadUrl as string | undefined);
              out.push({ id, storeUrl });
            }
          } catch {
            // not a dxDataGrid
          }
        }
        return out;
      });
      console.log(`  Grids found:`, gridInfo);

      // Look for download/export buttons
      const downloadInfo = await session.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="Download"], a[href*="Export"], a[href*="Excel"], button[onclick*="export"], button[onclick*="download"]'));
        return links.map((l) => ({
          tag: l.tagName,
          text: (l as HTMLElement).innerText?.trim().slice(0, 50),
          href: (l as HTMLAnchorElement).href ?? null,
          onclick: l.getAttribute("onclick") ?? null,
        }));
      });
      console.log(`  Download links:`, downloadInfo);
    }
  } finally {
    await session.close();
  }

  writeFileSync("debug-pihps-tabel-probe.json", JSON.stringify(captured, null, 2));
  console.log(`\n${captured.length} JSON/data responses captured → debug-pihps-tabel-probe.json`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
