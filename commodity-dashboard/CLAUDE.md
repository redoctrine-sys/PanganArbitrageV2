# PanganArbitrage V2 — Project Brain

> **Updated**: 2026-05-01 · Stack: Next.js 14 App Router · TypeScript · Supabase · Tailwind 3 · Recharts
> Deploy: Vercel Hobby ($0) · AI: Gemini Flash ($0) + Claude Sonnet ($20-50/mo Phase 3)

## Boot sequence
1. Read `.claude/WORKBENCH.md` first — tracks current task & debt
2. Don't auto-read other files until needed

## Project scope
Dashboard harga komoditas pangan RI (Jawa, Madura, Bali, Lombok).
- Phase 1: SP2KP data pipeline + dashboard (✅ ~85% done)
- Phase 2: AI arbitrage detection — Gemini Flash, $0 (🟡 next)
- Phase 3: Full agentic system — Hermes + 4 workers, $20-50/mo (⚪ planned)

---

## Code Rules (All Agents Must Follow)

| # | Rule | Severity |
|---|------|----------|
| 1 | **Tailwind only** — utility classes. NO inline `style={{}}`. NO custom CSS. | 🔴 |
| 2 | **No duplication** — check `lib/analytics/metrics.ts` + `lib/constants.ts` first. | 🔴 |
| 3 | **File size** — page >200 lines MUST split. API >150 → extract to lib/. | 🔴 |
| 4 | **Pure functions must have tests** — parser, metrics, date, arbitrage. | 🔴 |
| 5 | **Use `useSWR`** — no raw `fetch` in components. | 🟡 |
| 6 | **Error boundaries** — required at every page level. | 🟡 |
| 7 | **Type safety** — no `any`. Recharts props properly typed. | 🟠 |

---

## SP2KP Parser (`lib/csv/sp2kp-parser.ts`)
- Support XLSX dan CSV. Binary vs text (magic bytes). UTF-8/UTF-16 LE/BOM.
- Strip trailing space: `'Komoditas '`, `'HET/HA '`.
- Scope: `31`–`36` (Jawa), `51` (Bali), `52` (NTB → Lombok only). Madura: `3526`–`3529`.
- **Skala**: SP2KP simpan dalam RIBU — `35` = Rp 35.000. Parser × 1000 sekali.
- HET/HA: ~9% null = normal. Tanggal: `DD/MM/YYYY` → `YYYY-MM-DD`.

## Database
- `prices_raw`: UNIQUE(date, city_raw, commodity_raw, source). Bulk RPC insert.
- `cities`: auto-seeded dari kode_wilayah. Phase 2 cross-source canonicalization.
- `transport_vendors`: biaya transport untuk kalkulasi arbitrase.
- `commodities`: 17 komoditas SP2KP (seeded).
- RPCs: `get_sp2kp_latest()`, `bulk_insert_sp2kp_prices()`, `auto_seed_cities()`.
- 13 migrations (001–013). Phase 2 tambah `014_arbitrage_alerts.sql`.

## Constants — `lib/constants.ts`
```
PRICE_SCALE=1000  HET_ANOMALY_THRESHOLD=1.02  TREND_FLAT_THRESHOLD=0.01
CHART_DAYS_DEFAULT=30  CHART_DAYS_MAX=400  PRICE_LIMIT_PER_QUERY=5000
```
Phase 2 tambah: PROVINCE_MAP, COMMODITY_CATEGORIES, MIN_PROFIT_THRESHOLD.

## API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/csv/preview` | POST | Parse file, return stats (NO insert) |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/prices` | GET | Daily price series for chart |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | CRUD | Transport vendor data |
| `/api/health` | GET | DB diagnostic |

## Component Structure
```
components/
├── layout/      Sidebar, Topbar
├── sp2kp/       SP2KPPage, CityRow, CitySubRow, CommodityGroupRow, CommodityRow, ChartPanel
├── charts/      PriceLineChart, CandlestickChart
├── csv/         CSVUploader
├── pedagang/    VendorTransportPage, VendorModal, VendorDetailPanel, vendor.types.ts
├── arbitrase/   ArbitrasePage (🔴 756 baris — MUST SPLIT)
├── admin/       AdminCitiesPage (🟡 365 baris)
└── pills/       ChangePill, VolatilityPill, MiniSparkline
```

## Styling
- **Tailwind only** — migration selesai 2026-05-01
- `globals.css`: `@layer components` + `@apply` murni Tailwind
- Exception: `gridTemplateColumns` (dynamic), pip color (dynamic prop)
- CSS vars: `--font-sans/serif/mono` only (dipakai tailwind.config.ts)

## Design Tokens (tailwind.config.ts)
`sp:#1b5e3b` `ped:#4a3728` `up:#166534` `dn:#991b1b` `warn:#78350f`
Paper `#f5f1ea`, ink `#1a1612`. Serif=Fraunces, mono=DM Mono, sans=DM Sans.

## Display Logic
- SP2KP: RPC → client-side group/filter. Metrics via `lib/analytics/metrics.ts`.
- Chart: GET `/api/prices` lazy on expand. Accordion: 1 kota, 1 komoditas.

## 17 Komoditas SP2KP
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras, Tepung Terigu

---

## AI Agent Architecture (Phase 2 + 3)

```
Phase 2 ($0):
└── Arbitrage Agent — statistical Layer 1 + Gemini insight Layer 2

Phase 3 ($20-50/mo):
    Hermes (Claude Sonnet — orchestrator)
    ├── Multi-Scraper      (Gemini Flash Free, cron)
    ├── Analisis            (Gemini Flash Free, per-request)
    ├── Prediksi            (Statistical + Flash, daily)
    └── NLQ                 (Gemini Flash Free, on-demand)
```

### Tool Definitions (`lib/ai/tools.ts`) — 7 tools
```
getPriceSeries(kodeWilayah, commodityId, days)
getLatestPrices(island?, province?)
calculateArbitrage(fromCity, toCity, commodityId, transportMode?)
detectAnomaly(kodeWilayah, commodityId, threshold=1.02)
getPricePrediction(kodeWilayah, commodityId, daysAhead, includeWeather)
getSentimentAnalysis(commodityId, daysBack)
triggerScraper(source, forceRefresh)
```

### System Prompts (`lib/ai/prompts.ts`)
- **NLQ (PanganBot)**: Query harga, tren, anomali, arbitrase, prediksi. Tool-first, no guessing.
- **Analisis (Profit Scout)**: HET >2%, spread >10%, profit > Rp50k. Output: alerts + insights JSON.
- **Prediksi (Oracle)**: 60% historical + 25% weather + 15% sentiment. ±5% (3d), ±12% (7d).

### Data Flow
```
Phase 2: Trigger → prices → detectAnomalies() + findArbitrage() → Gemini → alerts → Dashboard
Phase 3: Scrapers → prices_* → prices_all VIEW → Analisis → alerts
                                                → Prediksi → forecasts
                                                → NLQ ← user query → ChatPanel
```

### Target Folder Structure (`lib/ai/`)
```
lib/ai/
├── tools.ts           prompts.ts          orchestrator.ts (P3)
├── shared-memory.ts (P3)                  resilience.ts (P3)
└── agents/
    ├── arbitrage/     gemini-agent.ts, prompts.ts, types.ts  (P2)
    ├── scraper/       (P3)
    ├── prediksi/      model.ts, sentiment.ts  (P3)
    └── nlq/           intent.ts, router.ts  (P3)
```

### Infrastructure
| Component | Provider | Cost |
|-----------|----------|------|
| Database | Supabase Free | $0 |
| VPS (Hermes) | Oracle Cloud Always Free | $0 |
| Frontend | Vercel Hobby | $0 |
| AI Workers | Gemini Flash Free | $0 |
| Orchestrator | Claude Sonnet (Phase 3 only) | $20-50/mo |

---

## Phase 2 Hooks (Don't Break)
- `prices_raw.source` — Phase 2 adds 'pedagang', 'marketplace'
- `cities.kode_wilayah` — PK for cross-source canonicalization
- `/api/ingest/sp2kp` after insert → trigger `/api/agents/arbitrage`
- `findArbitrage()` accepts `PricePoint[]` from any source
