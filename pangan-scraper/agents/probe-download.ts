/**
 * Probe: capture the exact XHR/download endpoint triggered by the
 * "Download Data" (Unduh) button on bi.go.id/hargapangan TabelHarga pages.
 *
 * Run: npx tsx agents/probe-download.ts
 * Output: debug-pihps-download-probe.json
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { launchBrowser } from "../shared/browser";

const PAGE_URL =
  "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas";

async function main(): Promise<void> {
  const session = await launchBrowser({ headless: false }); // headless=false so you can watch
  const captured: Array<{
    trigger: string;
    url: string;
    method: string;
    postData?: string;
    status: number;
    contentType: string;
    bodyLength: number;
    bodySnippet: string;
  }> = [];

  let trigger = "initial";

  session.page.on("response", async (resp) => {
    const url = resp.url();
    const ct = resp.headers()["content-type"] ?? "";

    // Capture all BI hargapangan API calls and any file downloads
    if (
      (url.includes("/hargapangan/") || url.includes("/TabelHarga/")) &&
      !url.match(/\.(css|js|png|woff2?|ttf|ico)(\?|$)/) &&
      resp.request().resourceType() !== "image"
    ) {
      const isDownload =
        ct.includes("excel") ||
        ct.includes("csv") ||
        ct.includes("octet-stream") ||
        ct.includes("spreadsheet");
      const isJson = ct.includes("json");

      if (isDownload || isJson) {
        const body = await resp.text().catch(() => "(binary)");
        const entry = {
          trigger,
          url,
          method: resp.request().method(),
          postData: resp.request().postData() ?? undefined,
          status: resp.status(),
          contentType: ct,
          bodyLength: body.length,
          bodySnippet: body.slice(0, 600),
        };
        captured.push(entry);

        const marker = isDownload ? "🟢 DOWNLOAD" : "📡";
        console.log(
          `${marker} [${trigger}] ${resp.request().method()} ${url.slice(0, 100)} → ${resp.status()} (${ct.slice(0, 40)}, ${body.length} bytes)`,
        );
        if (isDownload) {
          console.log("  ⭐ DOWNLOAD FOUND! PostData:", resp.request().postData()?.slice(0, 300));
        }
      }
    }
  });

  try {
    console.log(`Loading ${PAGE_URL}...`);
    await session.page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await session.page.waitForTimeout(6000);

    // --- List all button-like elements for inspection ---
    const buttons = await session.page.evaluate(() => {
      const all = Array.from(
        document.querySelectorAll('button, a, [onclick], .dx-button, [data-action]'),
      );
      return all
        .map((el) => ({
          tag: el.tagName,
          text: (el as HTMLElement).innerText?.trim().slice(0, 60) ?? "",
          href: (el as HTMLAnchorElement).href ?? null,
          onclick: el.getAttribute("onclick") ?? null,
          class: el.className?.slice?.(0, 60) ?? "",
          id: el.id ?? "",
          type: (el as HTMLButtonElement).type ?? "",
        }))
        .filter(
          (b) =>
            b.text.match(/unduh|download|export|excel|csv/i) ||
            b.onclick?.match(/download|export|excel|unduh/i) ||
            b.href?.match(/download|export|excel|unduh/i) ||
            b.id?.match(/download|export|excel|unduh/i) ||
            b.class?.match(/download|export|excel|unduh/i),
        );
    });

    console.log(`\n=== Download-related buttons/links (${buttons.length}) ===`);
    buttons.forEach((b, i) => console.log(`  [${i}]`, JSON.stringify(b)));

    // --- Try clicking each download-looking element ---
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      trigger = `click_${i}_${btn.text.slice(0, 20)}`;
      console.log(`\n--- Clicking [${i}]: "${btn.text}" ---`);
      try {
        if (btn.id) {
          await session.page.click(`#${CSS.escape(btn.id)}`);
        } else if (btn.text) {
          const locator = session.page.getByText(btn.text, { exact: false }).first();
          await locator.click({ timeout: 5000 });
        } else if (btn.href) {
          trigger = `navigate_${btn.href.slice(-30)}`;
          await session.page.goto(btn.href, { timeout: 15000 });
        }
        await session.page.waitForTimeout(4000);

        // Check if a download dialog / new tab opened
        const pages = session.page.context().pages();
        if (pages.length > 1) {
          console.log("  New tab opened:", pages[pages.length - 1].url());
        }
      } catch (err) {
        console.log(`  Could not click: ${(err as Error).message}`);
      }
    }

    // --- Also scan all iframes for download links ---
    const frames = session.page.frames();
    console.log(`\nFrames: ${frames.length}`);
    for (const frame of frames.slice(1)) {
      console.log(`  Frame url: ${frame.url()}`);
    }

    // --- Try guessing known BI download endpoints directly ---
    console.log("\n=== Probing guessed download endpoints ===");
    const guesses = [
      "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/DownloadDataKomoditas",
      "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/ExportExcel",
      "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/DownloadExcel",
      "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/GetDataExcel",
      "https://www.bi.go.id/hargapangan/WebSite/TabelHarga/ExportDataKomoditas",
    ];
    const params = new URLSearchParams({
      price_type_id: "1",
      comcat_id: "cat_1",
      province_id: "",
      regency_id: "",
      showKota: "false",
      showPasar: "false",
      tipe_laporan: "1",
      start_date: "2026-05-01",
      end_date: "2026-05-05",
      _: String(Date.now()),
    });

    for (const guessUrl of guesses) {
      trigger = `guess_${guessUrl.split("/").pop()}`;
      const full = `${guessUrl}?${params}`;
      console.log(`  Trying: ${full.slice(0, 100)}`);
      try {
        await session.page.goto(full, { timeout: 10000, waitUntil: "domcontentloaded" });
        await session.page.waitForTimeout(2000);
        const ct = await session.page.evaluate(() => document.contentType ?? "");
        const bodyLen = await session.page.evaluate(() => document.body?.innerText?.length ?? 0);
        console.log(`    → contentType=${ct} bodyLen=${bodyLen}`);
      } catch (err) {
        console.log(`    → error: ${(err as Error).message}`);
      }
    }
  } finally {
    await session.close();
  }

  writeFileSync(
    "debug-pihps-download-probe.json",
    JSON.stringify(captured, null, 2),
  );
  console.log(`\n${captured.length} responses captured → debug-pihps-download-probe.json`);
}

// CSS.escape polyfill for Node
if (typeof globalThis.CSS === "undefined") {
  (globalThis as unknown as Record<string, unknown>).CSS = {
    escape: (v: string) => v.replace(/[^\w-]/g, "\\$&"),
  };
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
