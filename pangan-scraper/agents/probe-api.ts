/**
 * Probe v2: trigger real /GetVectorMapData call by clicking the "Tampilkan" button.
 * Capture exact URL + params + response from network.
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { launchBrowser } from "../shared/browser";

async function main(): Promise<void> {
  const url = "https://www.bi.go.id/hargapangan";
  const session = await launchBrowser({ headless: true });

  const captured: Array<{ url: string; method: string; postData?: string; status: number; body: string }> = [];

  session.page.on("response", async (resp) => {
    const reqUrl = resp.url();
    if (reqUrl.includes("/GetVectorMapData") || reqUrl.includes("/UpdateChartData") || reqUrl.includes("/UpdateMapColor")) {
      const body = await resp.text().catch(() => "");
      captured.push({
        url: reqUrl,
        method: resp.request().method(),
        postData: resp.request().postData() ?? undefined,
        status: resp.status(),
        body: body.slice(0, 1500),
      });
      console.log(`📡 ${resp.request().method()} ${reqUrl.slice(0, 120)} → ${resp.status()} (${body.length} bytes)`);
    }
  });

  try {
    console.log("Loading page...");
    await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await session.page.waitForTimeout(8000);

    // Set province dropdown to DKI Jakarta (cboProvince — drives top map)
    console.log("\nSet cboProvince=12 (DKI Jakarta)...");
    await session.page.evaluate(() => {
      const w = window as unknown as { $: (s: string) => { dxSelectBox: (k: string) => { option: (k: string, v: number) => void } } };
      w.$("#cboProvince").dxSelectBox("instance").option("value", 12);
    });
    await session.page.waitForTimeout(3000);

    // Trigger topButtonOnClick (the "Tampilkan" button)
    console.log("\nTrigger topButtonOnClick()...");
    await session.page.evaluate(() => {
      const w = window as unknown as { topButtonOnClick?: () => void };
      if (typeof w.topButtonOnClick === "function") w.topButtonOnClick();
    });
    await session.page.waitForTimeout(5000);

    // Try setting a regency too
    console.log("\nList regencies for DKI Jakarta...");
    const regencies = await session.page.evaluate(async () => {
      const w = window as unknown as { $: (s: string) => { dxSelectBox: (k: string) => { getDataSource: () => { load: () => Promise<unknown>; items: () => unknown[] } } } };
      const ds = w.$("#cboRegency").dxSelectBox("instance").getDataSource();
      await ds.load();
      return ds.items() as Array<{ regency_id: number; regency_name: string }>;
    });
    console.log(`Regencies: ${regencies.length}`);
    if (regencies.length > 0) {
      console.log(`First 3:`, regencies.slice(0, 3));

      // Set first regency
      const firstReg = regencies[0];
      console.log(`\nSet cboRegency=${firstReg.regency_id} (${firstReg.regency_name})...`);
      await session.page.evaluate((id) => {
        const w = window as unknown as { $: (s: string) => { dxSelectBox: (k: string) => { option: (k: string, v: number) => void } } };
        w.$("#cboRegency").dxSelectBox("instance").option("value", id);
      }, firstReg.regency_id);
      await session.page.waitForTimeout(2000);

      // Trigger again
      console.log("\nRe-trigger topButtonOnClick() with regency...");
      await session.page.evaluate(() => {
        const w = window as unknown as { topButtonOnClick?: () => void };
        if (typeof w.topButtonOnClick === "function") w.topButtonOnClick();
      });
      await session.page.waitForTimeout(5000);
    }
  } finally {
    await session.close();
  }

  writeFileSync("debug-pihps-api-captured.json", JSON.stringify(captured, null, 2));
  console.log(`\n${captured.length} requests captured → debug-pihps-api-captured.json`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
