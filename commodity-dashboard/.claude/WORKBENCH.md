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

## Reference
- `Project Update/` — archived planning docs
- `CLAUDE.md` — project brain + AI agent architecture
