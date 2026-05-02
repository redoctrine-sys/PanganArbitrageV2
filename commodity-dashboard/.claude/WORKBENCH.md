# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*

## Status: Phase 2 Complete ✅ → Phase 3 Planning

---

## Phase 1: Data Foundation — ✅ Complete

### ✅ Done
- [x] DB schema + seed migrations (001–013)
- [x] SP2KP parser (encoding, dates, ×1000)
- [x] API routes (preview, ingest, prices, latest, cities, transport-vendors)
- [x] CSVUploader → DropZone + UploadBlocks (split)
- [x] SP2KP page (By City / By Commodity, filters, sortable) → SP2KPHeader extracted
- [x] ChartPanel (daily line `connectNulls` fix + candlestick W/M)
- [x] Auto-seed cities + RLS
- [x] Server-side ingest + chunked bulk RPC
- [x] Vercel deploy (vercel.json)
- [x] Vendor Transport CRUD + detail panel
- [x] Admin cities page → CityEditModal extracted
- [x] Extract constants → `lib/constants.ts` (PROVINCE_MAP, ISLAND_MAP, COMMODITY_CATEGORIES)
- [x] Unit tests: `parser.test.ts`, `metrics.test.ts`
- [x] Tailwind-only migration (globals.css, all components)
- [x] Split VendorTransportPage → 4 files
- [x] **Split ArbitrasePage.tsx** (756 → ~80) → types, AISubtab, ManualSubtab, LegCard
- [x] ErrorBoundary → dipasang di dashboard layout

---

## Phase 2: AI-Powered Arbitrage — ✅ Complete

### ✅ Done
- [x] `014_arbitrage_alerts.sql` — table + RLS
- [x] `lib/ai/agents/arbitrage/types.ts`
- [x] `lib/analytics/arbitrage.ts` — detectAnomalies(), findArbitrage() (pure, testable)
- [x] `lib/ai/agents/arbitrage/prompts.ts` — Profit Scout system prompt
- [x] `lib/ai/agents/arbitrage/gemini-agent.ts` — Gemini Flash + graceful fallback
- [x] `app/api/agents/arbitrage/route.ts` — POST, Layer 1 + Layer 2 + DB insert
- [x] `components/arbitrase/AlertCard.tsx`
- [x] `components/arbitrase/AlertBadge.tsx` — live unread count
- [x] `components/arbitrase/AlertCenter.tsx` — filter bar + manual run trigger
- [x] AISubtab: now renders AlertCenter (real alerts, not demo cards)
- [x] Sidebar: AlertBadge di Arbitrase nav item
- [x] ingest/sp2kp: fire-and-forget trigger post-ingest

### ✅ Debt Cleared (2026-05-02)
- [x] Split AlertCard.tsx (530 → 79 lines) → 8 sub-components, Alert discriminated union
- [x] Write arbitrage.test.ts — 20 tests for detectAnomalies, findArbitrage, calcWeightLossPct

### ✅ Debt Cleared (2026-05-02) — continued
- [x] **useSWR migration** — raw fetch+useEffect removed from all 6 components
  - `SP2KPPage.tsx` — useSWR key `/api/sp2kp/latest?island=...`
  - `ChartPanel.tsx` — useSWR key `/api/prices?...&days=...`
  - `ArbitrasePage.tsx` — useSWR `/api/transport-vendors` (shared cache with VendorPage)
  - `AlertCenter.tsx` — useSWR + mutate() for runAgent/markRead
  - `VendorTransportPage.tsx` — useSWR + mutate() after save/delete
  - `AdminCitiesPage.tsx` — useSWR + mutate() after save
  - New: `lib/utils/fetcher.ts` — typed generic fetcher

### ⚠️ Next Steps Before Phase 2 Fully Live
1. **Jalankan migration 014** di Supabase SQL Editor:
   `supabase/migrations/014_arbitrage_alerts.sql`
2. **Test manual**: POST `/api/agents/arbitrage` dari dashboard → klik "Jalankan Analisis"
3. Verifikasi alerts muncul di AlertCenter
4. (Opsional) Tambah cron trigger di `vercel.json`

---

## Phase 3: Full Agentic System — ⚪ Planned

### Infrastructure
- [ ] Oracle Cloud VPS (Hermes)
- [ ] GitHub Actions cron

### Agents
- [ ] Multi-Scraper — SP2KP, Pedagang, Marketplace, External (cron)
- [ ] Analisis upgrade — cross-source comparison
- [ ] Prediksi — exponential smoothing + weather + sentiment
- [ ] NLQ Chat — Vercel AI SDK, ChatPanel, 7 tools

### Database
- [ ] `prices_pedagang`, `prices_marketplace`, `external_sources`
- [ ] `price_predictions`, `agent_logs`
- [ ] `prices_all` VIEW (unified)

### UI
- [ ] `components/ai/ChatPanel.tsx`
- [ ] `components/ai/SuggestionChips.tsx`
- [ ] `components/ai/AgentStatusBadge.tsx`

---

## Task Aktif
**Jalankan migration 014 di Supabase** → test `POST /api/agents/arbitrage` → cek AlertCenter.

Sidebar nav sudah distrukturisasi: SP2KP · Harga Pedagang · Vendor Transport · Data Lain (masing-masing main tab).

---

## Alur Data (Data Flow Architecture)

```
SUMBER DATA
├── SP2KP (Live ✅)
│   └── Upload CSV/XLSX → ingest/sp2kp → sp2kp_prices → sp2kp_latest VIEW
│       └── ──→ (trigger) agents/arbitrage → arbitrage_alerts
│
├── Harga Pedagang (Phase 3 🔲)
│   └── Scraper / Manual input → prices_pedagang table
│       └── ──→ prices_all VIEW (unified)
│
├── Vendor Transport (Live ✅)
│   └── Manual CRUD → transport_vendors table
│       └── ──→ dikonsumsi arbitrase kalkulator (Layer 1 cost calc)
│
└── Data Lain (Phase 3 🔲)
    └── Marketplace scraper / External API → external_sources table
        └── ──→ prices_all VIEW (unified)

ANALITIK
├── Komparasi (Phase 3 🔲)
│   └── Membandingkan SP2KP vs Pedagang vs Marketplace (dari prices_all)
│
└── Arbitrase (Phase 2 ✅)
    ├── Layer 1: detectAnomalies() + findArbitrage() dari sp2kp_latest + transport_vendors
    └── Layer 2: Gemini Flash → insights → arbitrage_alerts table
        └── UI: AlertCenter (filter, mark read, manual run)

FUTURE: prices_all VIEW akan unify SP2KP + Pedagang + Marketplace
         → Arbitrase bisa cross-source (lebih akurat)
         → Komparasi bisa cross-source comparison
```

## Reference
- `Project Update/` — archived planning docs
- `CLAUDE.md` — project brain + AI agent architecture
