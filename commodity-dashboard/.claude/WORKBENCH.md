# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*

## Status: Phase 1 Debt Cleanup

---

## Phase 1: Data Foundation — ✅ Complete + 🔴 Debt

### ✅ Done
- [x] DB schema + seed migrations (001–013)
- [x] SP2KP parser (encoding, dates, ×1000)
- [x] API routes (preview, ingest, prices, latest, cities, transport-vendors)
- [x] CSVUploader + preview modal
- [x] SP2KP page (By City / By Commodity, filters, sortable)
- [x] ChartPanel (daily line + candlestick W/M)
- [x] Auto-seed cities + RLS
- [x] Server-side ingest + chunked bulk RPC
- [x] Vercel deploy (vercel.json)
- [x] Vendor Transport CRUD + detail panel
- [x] Arbitrase tab demo (manual calculator)
- [x] Admin cities page (lat/lng editor)
- [x] Extract constants → `lib/constants.ts`
- [x] Unit tests: `parser.test.ts`, `metrics.test.ts`
- [x] Tailwind-only migration (globals.css, all components)
- [x] Split VendorTransportPage → 4 files

### 🔴 Debt (must clear before Phase 2)
- [ ] **Split ArbitrasePage.tsx** (756 baris → <200) — HIGHEST PRIORITY
- [ ] Split AdminCitiesPage.tsx (365 → <200)
- [ ] Split CSVUploader.tsx (324 → <200)
- [ ] Trim SP2KPPage.tsx (297 → <200)
- [ ] Trim CommodityGroupRow.tsx (277 → <200)
- [ ] Extract DetailRow base (CommodityRow + CitySubRow ~80% identical)
- [ ] Error boundaries di dashboard layout
- [ ] Lengkapi constants.ts (PROVINCE_MAP, COMMODITY_CATEGORIES)
- [ ] Migrate fetch → useSWR di components

---

## Phase 2: AI-Powered Arbitrage — ⚪ Blocked by Phase 1 debt

### Core Logic
- [ ] `lib/analytics/arbitrage.ts` — detectAnomalies(), findArbitrage()
- [ ] `lib/ai/agents/arbitrage/gemini-agent.ts` — analyzeWithGemini()
- [ ] `lib/ai/agents/arbitrage/prompts.ts` — Profit Scout prompt
- [ ] `lib/ai/agents/arbitrage/types.ts`
- [ ] `tests/analytics.test.ts`

### Database
- [ ] Migration `014_arbitrage_alerts.sql`
- [ ] RLS: public read

### API + Triggers
- [ ] `app/api/agents/arbitrage/route.ts` — POST endpoint
- [ ] Hook: `/api/ingest/sp2kp` → trigger arbitrage after insert
- [ ] Cron: vercel.json atau GitHub Actions (6 jam)

### Dashboard UI
- [ ] `components/arbitrage/AlertCenter.tsx`
- [ ] `components/arbitrage/AlertCard.tsx`
- [ ] `components/arbitrage/AlertBadge.tsx` (Sidebar unread count)
- [ ] `components/arbitrage/AlertFilter.tsx`

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
Next: **Split ArbitrasePage.tsx** (756 baris → 5 sub-components).

## Issues / Blockers
- ArbitrasePage.tsx blocks Phase 2 integration
- constants.ts belum punya PROVINCE_MAP & COMMODITY_CATEGORIES

## Reference
- `Project Update/` — archived planning docs
- `CLAUDE.md` — project brain + AI agent architecture
