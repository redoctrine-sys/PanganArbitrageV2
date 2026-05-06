/**
 * Probe: hit GetGridDataKomoditas with pure fetch (no Playwright, no cookie).
 * If works stateless → v3 scraper can drop Playwright entirely.
 */

import "dotenv/config";

const BASE = "https://www.bi.go.id/hargapangan/WebSite/TabelHarga";

async function get(url: string): Promise<{ status: number; body: string }> {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.bi.go.id/hargapangan/TabelHarga/PasarTradisionalKomoditas",
    },
  });
  return { status: r.status, body: await r.text() };
}

async function main(): Promise<void> {
  // Test 1: GetRefCommodityAndCategory — list categories
  console.log("\n=== Test 1: GetRefCommodityAndCategory ===");
  const r1 = await get(`${BASE}/GetRefCommodityAndCategory?_=${Date.now()}`);
  console.log(`status=${r1.status} body length=${r1.body.length}`);
  console.log(r1.body.slice(0, 400));

  // Test 2: GetGridDataKomoditas (cat_1=Beras, today)
  console.log("\n=== Test 2: GetGridDataKomoditas cat_1, today ===");
  const today = new Date().toISOString().slice(0, 10);
  const url2 = `${BASE}/GetGridDataKomoditas?price_type_id=1&comcat_id=cat_1&province_id=&regency_id=&showKota=false&showPasar=false&tipe_laporan=1&start_date=${today}&end_date=${today}&_=${Date.now()}`;
  const r2 = await get(url2);
  console.log(`status=${r2.status} body length=${r2.body.length}`);
  console.log(r2.body.slice(0, 800));

  // Test 3: GetGridDataKomoditas with 7-day range, cat_5 (Bawang Merah)
  console.log("\n=== Test 3: cat_5 (Bawang Merah), 7-day range ===");
  const start = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const url3 = `${BASE}/GetGridDataKomoditas?price_type_id=1&comcat_id=cat_5&province_id=&regency_id=&showKota=false&showPasar=false&tipe_laporan=1&start_date=${start}&end_date=${today}&_=${Date.now()}`;
  const r3 = await get(url3);
  console.log(`status=${r3.status} body length=${r3.body.length}`);
  console.log(r3.body.slice(0, 800));

  // Test 4: regency drill — DKI Jakarta (id=13), cat_1
  console.log("\n=== Test 4: DKI Jakarta regency drill, cat_1 ===");
  const url4 = `${BASE}/GetGridDataKomoditas?price_type_id=1&comcat_id=cat_1&province_id=13&regency_id=&showKota=true&showPasar=false&tipe_laporan=1&start_date=${today}&end_date=${today}&_=${Date.now()}`;
  const r4 = await get(url4);
  console.log(`status=${r4.status} body length=${r4.body.length}`);
  console.log(r4.body.slice(0, 800));

  // Test 5: GetRefRegency for Jawa Barat (id=12)
  console.log("\n=== Test 5: GetRefRegency for Jawa Barat ===");
  const r5 = await get(`${BASE}/GetRefRegency?price_type_id=1&ref_prov_id=12&_=${Date.now()}`);
  console.log(`status=${r5.status} body length=${r5.body.length}`);
  console.log(r5.body.slice(0, 600));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
