# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*
*Updated: 2026-05-05 — based on blueprint_summary_review_v3.md*

## Status: Phase 2 ~85% ✅ → Phase 2.5 🟡 In Progress (PIHPS Scraper)

> **AI Stack**: Gemini Flash (primary, $0). Tidak ada DeepSeek.

### 🟡 Phase 2.5 Active (2026-05-05)
- [x] Migration 026: `scrape_runs` table + `get_pihps_latest` RPC
- [x] Sibling repo `pangan-scraper/` bootstrapped (package.json, tsconfig, .env.example)
- [x] Shared framework: `shared/{types,browser,normalizer,supabase,logger}.ts`
- [x] PIHPS agent: `agents/pihps.ts` — Playwright + Gemini Flash extraction
- [x] GitHub Actions cron: `.github/workflows/scrape.yml` (4×/day)
- [x] Dashboard: `/api/pihps/latest` + `/dashboard/pihps` page + `PIHPSPage.tsx`
- [x] Sidebar nav: PIHPS item under Sumber Data

### ⏭ Next Steps Before PIHPS Live
1. **Run migration 026** di Supabase SQL Editor: `supabase/migrations/026_pihps_scraper.sql`
2. **Install scraper deps**: `cd ../pangan-scraper && npm install && npm run install-browsers`
3. **Set scraper env**: copy `.env.example` → `.env`, fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
4. **Smoke test**: `npm run scrape:pihps:debug` — saves debug-pihps-*.html for selector verification
5. If selectors mismatch: inspect debug HTML, adjust `captureProvinceTable()` in `agents/pihps.ts`
6. Verify rows appear at `/dashboard/pihps`
7. Wire up GitHub Actions secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)

---

## Phase 1: Data Foundation — ✅ ~90% Complete

### ✅ Done
- [x] DB schema + seed migrations (001–025)
- [x] SP2KP parser (encoding, dates, ×1000)
- [x] API routes (preview, ingest, prices, latest, cities, transport-vendors)
- [x] CSVUploader → DropZone + UploadBlocks (split)
- [x] SP2KP page (By City / By Commodity, filters, sortable)
- [x] ChartPanel (daily line + candlestick W/M)
- [x] Auto-seed cities + RLS
- [x] Server-side ingest + chunked bulk RPC
- [x] Vercel deploy (vercel.json)
- [x] Vendor Transport CRUD + detail panel
- [x] Admin cities page → CityEditModal extracted
- [x] Extract constants → `lib/constants.ts`
- [x] Unit tests: `parser.test.ts`, `metrics.test.ts`
- [x] Tailwind-only migration (globals.css, all components)
- [x] ErrorBoundary → dipasang di dashboard layout
- [x] **useSWR migration** — all 6 components migrated

### 🟡 Remaining Debt (Phase 1)
- [ ] Split 6 oversized components (>200 lines):
  - `VendorTransportPage.tsx` (291L)
  - `CommodityGroupRow.tsx` (246L)
  - `SP2KPPage.tsx` (237L)
  - `ChartPanel.tsx` (235L)
  - `AlertCenter.tsx` (235L)
  - `CandlestickChart.tsx` (215L)

---

## Phase 2: AI-Powered Arbitrage — ✅ ~85% Complete

### ✅ Done
- [x] `lib/analytics/arbitrage.ts` — detectAnomalies(), findArbitrage() (pure, testable)
- [x] `lib/ai/gemini-wrapper.ts` — Gemini Flash + quota + cache + fallback
- [x] `lib/ai/model-router.ts` — complexity classifier (Flash vs Pro)
- [x] `lib/ai/gemini-cache.ts` — smart cache per (commodity, cities)
- [x] `app/api/agents/arbitrage/route.ts` — POST, Layer 1 + Layer 2 + DB insert
- [x] AlertCard.tsx split (530 → 79 lines) → 8 sub-components ✅ (2026-05-02)
- [x] Alert → discriminated union `AnomalyAlertUI | ArbitrageAlertUI` ✅
- [x] `arbitrage.test.ts` — 20 unit tests (detectAnomalies×8, findArbitrage×5, calcWeightLoss×5) ✅
- [x] AlertCenter, AlertBadge, AlertCard, AlertFilter
- [x] Logistics Risk Analysis (ETA, weight loss, volatility, spread, ASDP ferry)
- [x] Manual Arbitrage Calculator (multi-leg, vendor selection, ROI)
- [x] SWR migration — all components, `lib/utils/fetcher.ts`

### ⚠️ Next Steps Phase 2
- [ ] Run migration 022 (api_usage_log + quota RPC)
- [ ] Run migration 023 (transport_edges, transfer_points, route_calculations)
- [ ] Run migration 024 (ai_insight_cache)
- [ ] Run migration 025 (agent_memory, experiment_log, workflow_checkpoint)
- [ ] Test `POST /api/agents/arbitrage` → verify AlertCenter

---

## Phase 2.5: Scraper Agents + Route Maker + Quota Alert — 🟡 ~10% (Next Sprint)

### 🔴 Priority 1: PIHPS Scraper Agent (~3 days)
- [ ] Setup `pangan-scraper/` repo (terpisah dari commodity-dashboard)
- [ ] `shared/browser.ts` — Playwright + stealth setup
- [ ] `shared/normalizer.ts` — **Gemini Flash** price normalization
- [ ] `shared/supabase.ts` — upsert ke `prices_raw` (source: "pihps")
- [ ] `shared/types.ts` — ScrapedPrice interface
- [ ] `agents/pihps.ts` — scrape bi.go.id/hargapangan (82 kota × 11 komoditas)
- [ ] `.github/workflows/scrape.yml` — cron 4×/day (06:00, 12:00, 18:00, 00:00 WIB)
- [ ] Test: run manual → verify ~900 price points upserted

### 🔴 Priority 2: Paskomnas Scraper Agent (~2 days)
- [ ] `agents/paskomnas.ts` — scrape paskomnas.id (Sayur/Buah/Bumbu/Daging)
- [ ] Normalize per-kg pricing (mostly already per-kg)
- [ ] Fuzzy match ke SP2KP commodity names
- [ ] Upsert ke prices_raw (source: "paskomnas")
- [ ] Add to scrape.yml (cron 1×/day)

### 🟡 Priority 3: Facebook Chrome Extension (~1 week)
- [ ] `agents/facebook/manifest.json` — Chrome MV3
- [ ] `agents/facebook/content-script.ts` — MutationObserver + **keyword trigger** (not regex-first)
- [ ] `agents/facebook/keywords.ts` — KeywordConfig: preset categories (BUMBU/POKOK/PROTEIN/SAYUR/BUAH) + custom user keywords
- [ ] `agents/facebook/background.ts` — **Gemini Flash** full-post extraction → save to **chrome.storage.local** (not Supabase)
- [ ] `agents/facebook/storage.ts` — CapturedPrice interface, local CRUD, pending/accepted/rejected status
- [ ] `agents/facebook/validator.ts` — auto-reject confidence < 0.6, dedup, sane price range
- [ ] `agents/facebook/popup.html` — **review queue** (Accept/Edit/Reject per item, bulk actions), keyword manager, stats
- [ ] `agents/facebook/popup.ts` — review logic: accept → POST `/api/scraper/ingest` → prices_raw
- [ ] `app/api/scraper/ingest/route.ts` — receive user-accepted prices + validate + upsert prices_raw
- [ ] Test: browse FB group → keyword match → Gemini extract → local staging → user review → push to Supabase

### 🟡 Priority 4: Route Maker (~1 week)
- [ ] `lib/route-maker/graph.ts` — Dijkstra/A* multi-modal graph
- [ ] `lib/route-maker/asdp-seed.ts` — ASDP ferry: Ketapang-Gilimanuk, Padangbai-Lembar
- [ ] `lib/route-maker/types.ts` — RouteLeg, RouteOption, EdgeWeight
- [ ] `app/api/route-maker/calculate/route.ts` — POST endpoint
- [ ] `app/dashboard/route-maker/page.tsx` — UI: from/to/commodity selector + result map
- [ ] Seed transport_edges (migration 023 data)

### 🟡 Priority 5: Gemini Quota Alert (~1 day)
- [ ] Run migration 022 — api_usage_log + RPC + daily view
- [ ] `lib/ai/gemini-wrapper.ts` — auto-log every Gemini call to api_usage_log
- [ ] `app/api/quota/status/route.ts` — real-time quota check
- [ ] `app/api/quota/daily/route.ts` — daily summary
- [ ] `components/layout/QuotaAlertBanner.tsx` — warning at 80%, block at 95%
- [ ] Add to dashboard layout.tsx

### 🟡 Priority 6: Source Filter on Dashboard (~0.5 day)
- [ ] SP2KP dashboard: toggle filter by source (SP2KP / PIHPS / Paskomnas / Facebook)
- [ ] Cross-source price comparison view

---

## Phase 3: Full Agentic System — ⚪ ~5% (Spec Ready, Future)

> **AI**: Semua Gemini Flash. Tidak ada DeepSeek, tidak ada Claude/Anthropic.

### Infrastructure
- [ ] GitHub Actions — orchestrator cron trigger
- [ ] Supabase migrations 025 (agent_memory, experiment_log, workflow_checkpoint) — run!

### Hermes Orchestrator (Gemini Flash)
- [ ] `lib/agents/orchestrator.ts` — DAG workflow engine
- [ ] `lib/agents/roles/research-agent.ts` — Hermes specialist
- [ ] `lib/agents/roles/validator-agent.ts` — Hermes judge
- [ ] `lib/agents/roles/route-planner-agent.ts` — Dijkstra/A* via Gemini
- [ ] `app/api/agents/orchestrate/route.ts` — trigger Hermes DAG

### Karpathy Experiment Loop (Gemini Flash)
- [ ] `lib/agents/experiment-loop.ts` — ratchet loop (10-min cycles)
- [ ] `lib/agents/roles/experiment-agent.ts` — modify arbitrage.ts + measure
- [ ] `app/api/agents/experiment/route.ts` — POST trigger
- [ ] Scalar metric: `precision_at_k` (alert accuracy)

### Agent Dashboard UI
- [ ] `app/dashboard/agentic/page.tsx`
- [ ] `components/agentic/AgentDashboard.tsx`
- [ ] `components/agentic/ExperimentLogViewer.tsx`
- [ ] `components/agentic/MemoryInspector.tsx`
- [ ] `app/api/agents/memory/route.ts` — GET/POST shared memory

### Future (Backlog)
- [ ] Sayurbox / Segari scraper (retail, Jabodetabek)
- [ ] TaniHub scraper (5-city)
- [ ] NLQ Chat (PanganBot) — Vercel AI SDK
- [ ] Price Prediction (Oracle) — exponential smoothing + weather
- [ ] Pedagang Data Input form
- [ ] Naming Agent (city + commodity fuzzy match)
- [ ] Dark mode
- [ ] Mobile responsive (fixed sidebar issue)
- [ ] E2E tests (Playwright)
- [ ] Pagination on SP2KP + AlertCenter

---

## Task Aktif (May 2026)

**Sprint Goal: Phase 2.5 Kickoff**
1. Run pending migrations (022–025) di Supabase
2. Init `pangan-scraper/` repo
3. Build PIHPS agent (Playwright + Gemini Flash)
4. Build Paskomnas agent
5. Wire QuotaAlertBanner ke dashboard

---

## Data Flow Architecture

```
SUMBER DATA
├── SP2KP (Live ✅)
│   └── Upload CSV/XLSX → ingest/sp2kp → prices_raw (source: sp2kp)
│       └── ──→ (trigger) agents/arbitrage → arbitrage_alerts
│
├── PIHPS / BI (🟡 Phase 2.5)
│   └── Playwright scraper → prices_raw (source: pihps)
│       └── ──→ cross-check SP2KP (independent govt agency)
│
├── Paskomnas (🟡 Phase 2.5)
│   └── Playwright/HTTP scraper → prices_raw (source: paskomnas)
│       └── ──→ wholesale benchmark
│
├── Facebook Pedagang (🟡 Phase 2.5)
│   └── Chrome Extension → /api/scraper/ingest → prices_raw (source: facebook)
│       └── ──→ real trader ground truth
│
└── Vendor Transport (Live ✅)
    └── Manual CRUD → transport_vendors table
        └── ──→ dikonsumsi arbitrase kalkulator + Route Maker

ANALITIK
├── Arbitrase (Phase 2 ✅)
│   ├── Layer 1: detectAnomalies() + findArbitrage() — pure TypeScript
│   └── Layer 2: Gemini Flash → insights → arbitrage_alerts
│
└── Route Maker (🟡 Phase 2.5)
    └── Dijkstra/A* graph → route_calculations → Route Maker UI

FUTURE
└── Hermes Orchestrator (⚪ Phase 3)
    ├── Research → Experiment → Validator → Route Planner (all Gemini Flash)
    └── Karpathy Loop → auto-improve arbitrage.ts
```

---

## Reference
- `Project Update/blueprint_summary_review_v3.md` — latest blueprint (2026-05-04)
- `CLAUDE.md` — project brain + AI architecture (Gemini-only)
- AI: Gemini Flash ($0) untuk semua — scraper normalization, arbitrage L2, orchestrator, experiment agent
