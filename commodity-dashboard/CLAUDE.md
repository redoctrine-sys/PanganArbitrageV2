# PanganArbitrage V2 — Project Brain

> **Last Updated**: 2026-05-01
> Stack: Next.js 14 App Router · TypeScript · Supabase · Tailwind 3 · Recharts
> Deploy: Vercel Hobby ($0)

## Boot sequence
1. Read `.claude/WORKBENCH.md` first — tracks current task & debt
2. Read `AGENTS.md` if working on AI agent features (Phase 2+)
3. Don't auto-read other files until needed

## Project scope
Dashboard harga komoditas pangan RI (Jawa, Madura, Bali, Lombok).
- Phase 1: SP2KP data pipeline + dashboard (✅ ~85% done)
- Phase 2: AI arbitrage detection — Gemini Flash, $0 (🟡 next)
- Phase 3: Full agentic system — Hermes + 4 workers, $20-50/mo (⚪ planned)

## SP2KP Parser — KRITIS (`lib/csv/sp2kp-parser.ts`)
- Support XLSX dan CSV (library `xlsx`). Binary vs text (magic bytes).
- Kolom WAJIB di-strip: `'Komoditas '` dan `'HET/HA '` trailing space.
- Filter scope: prefix kode `31`–`36` (Jawa), `51` (Bali), `52` (NTB → Lombok only).
- Madura: kode `3526`–`3529` → `island='Madura'` (province tetap Jawa Timur).
- **Skala harga**: SP2KP simpan dalam RIBU — `35` = Rp 35.000. Parser × 1000 sekali.
- HET/HA: ~9% null = normal. Tanggal: `DD/MM/YYYY` → `YYYY-MM-DD`.

## Database
- `prices_raw`: UNIQUE(date, city_raw, commodity_raw, source). INSERT via bulk RPC.
- `cities`: auto-seeded dari kode_wilayah. Untuk Phase 2 cross-source canonicalization.
- `transport_vendors`: biaya transport, dipakai kalkulasi arbitrase.
- `commodities`: 17 komoditas SP2KP (seeded).
- RPCs: `get_sp2kp_latest()`, `bulk_insert_sp2kp_prices()`, `auto_seed_cities()`.
- 13 migrations (001 → 013). Phase 2 tambah `014_arbitrage_alerts.sql`.

## Constants — `lib/constants.ts` (single source of truth)
```
PRICE_SCALE = 1000          HET_ANOMALY_THRESHOLD = 1.02
TREND_FLAT_THRESHOLD = 0.01 CHART_DAYS_DEFAULT = 30
CHART_DAYS_MAX = 400        PRICE_LIMIT_PER_QUERY = 5000
```
Phase 2 tambah: PROVINCE_MAP, COMMODITY_CATEGORIES, MIN_PROFIT_THRESHOLD.

## API routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/csv/preview` | POST | Parse file, return stats (NO insert) |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/prices` | GET | Daily price series for chart |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest, parallel per-province |
| `/api/health` | GET | DB diagnostic |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | GET/POST/PATCH/DELETE | Transport vendor CRUD |

## Styling rules (enforced)
- **Tailwind utilities ONLY** — migration sudah selesai 2026-05-01
- NO inline `style={{}}` — exception: `gridTemplateColumns` (dynamic), pip color (dynamic prop)
- Custom classes di `globals.css` pakai `@layer components` + `@apply` murni Tailwind
- CSS variables hanya: `--font-sans/serif/mono` (dipakai tailwind.config.ts)

## File size rules
- Page component: max 200 baris → MUST split
- API route: max 150 baris → extract to lib/
- Utility function: max 100 baris → split by concern
- Every pure function MUST have unit test

## Component structure (post-refactor)
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

## Display logic
- SP2KP: RPC `get_sp2kp_latest()` → client-side group/filter.
- Metrics (changePct, volatility, vsAvg, trend): `lib/analytics/metrics.ts`.
- Chart: GET `/api/prices` lazy on expand. Max 90d/400d.
- Accordion: 1 kota terbuka, 1 komoditas per kota.

## Design tokens (tailwind.config.ts)
`sp:#1b5e3b` `ped:#4a3728` `up:#166534` `dn:#991b1b` `warn:#78350f`
Paper `#f5f1ea`, ink `#1a1612`. Serif=Fraunces, mono=DM Mono, sans=DM Sans.

## 17 Komoditas SP2KP
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras,
Tepung Terigu

## Phase 2 hooks (don't break)
- `prices_raw.source` — filter 'sp2kp'; Phase 2 adds 'pedagang', 'marketplace'
- `cities.kode_wilayah` — PK for cross-source canonicalization
- `/api/ingest/sp2kp` after insert → will trigger `/api/agents/arbitrage`
- `findArbitrage()` accepts `PricePoint[]` from any source
