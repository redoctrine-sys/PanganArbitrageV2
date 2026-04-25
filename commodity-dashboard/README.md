# commodity-dashboard

PanganArbitrage Phase 1 — Tab SP2KP end-to-end (upload → ingest → display).
End-state target: `pangan-summary-v6.md`. UI/UX based on `pangan-v8.html` mockup.

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase project credentials
```

In Supabase SQL editor, run migrations in order:

1. `supabase/migrations/001_schema_core.sql`
2. `supabase/migrations/002_seed_commodities.sql`
3. `supabase/migrations/003_get_sp2kp_latest_fn.sql`
4. `supabase/migrations/004_auto_seed_cities.sql`

## Develop

```bash
npm run dev          # http://localhost:3000 → redirects to /dashboard/sp2kp
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

## Phase 1 scope

- ✅ Tab SP2KP: upload CSV/XLSX, preview, ingest, accordion (kota → komoditas → chart)
- ✅ HET/HA reference line on chart, anomaly highlighting if price > HET
- ✅ Filter: search, island (Jawa/Madura/Bali/Lombok), province
- ⏳ Tab Pedagang, Komparasi, Arbitrase, Admin → Phase 2+ (placeholders only)
- ⏳ Naming queue, commodity pairing, arbitrage engine → Phase 2+

## Files
- `src/lib/csv/sp2kp-parser.ts` — XLSX/CSV parser (handles DD/MM/YYYY + Excel serial dates)
- `src/lib/analytics/metrics.ts` — change %, volatility, vsAvg, trend
- `src/components/sp2kp/SP2KPPage.tsx` — main accordion layout
- `src/components/sp2kp/ChartPanel.tsx` — Recharts line chart + HET reference + 30-day stats
- `src/components/csv/CSVUploader.tsx` — modal with preview flow
- `CLAUDE.md` + `.claude/WORKBENCH.md` — agent memory

## SP2KP file format
Upload supports `.xlsx`, `.xls`, `.csv` (UTF-16 LE OK).
Required columns: `Kode Wilayah`, `Kabupaten Kota`, `Komoditas`, optional `HET/HA`,
plus per-day price columns either as `DD/MM/YYYY` strings or Excel date serials.

Scope filter: kode prefix `31`–`36` (Jawa, with Madura `3526`–`3529`),
`51` (Bali), `52` (NTB → only Lombok kab/kota).
