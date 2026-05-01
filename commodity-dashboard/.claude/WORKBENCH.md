# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*

## Status: Phase 1 Debt Cleanup → Phase 2 Prep

### Phase 1 — ✅ Complete
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
- [x] Split VendorTransportPage → 4 files (vendor.types, VendorModal, VendorDetailPanel)

### Phase 1 Debt — 🔴 In Progress
- [ ] **Split ArbitrasePage.tsx** (756 baris → <200) — HIGHEST PRIORITY
- [ ] Split AdminCitiesPage.tsx (365 baris → <200)
- [ ] Split CSVUploader.tsx (324 baris → <200)
- [ ] Trim SP2KPPage.tsx (297 baris → <200)
- [ ] Trim CommodityGroupRow.tsx (277 baris → <200)
- [ ] Extract DetailRow base (CommodityRow + CitySubRow ~80% identical)
- [ ] Error boundaries di dashboard layout
- [ ] Lengkapi constants.ts (PROVINCE_MAP, COMMODITY_CATEGORIES)
- [ ] Migrate fetch → useSWR di components

### Phase 2 — ⚪ Blocked by debt cleanup
- [ ] DB migration 014_arbitrage_alerts.sql
- [ ] `lib/analytics/arbitrage.ts` (detectAnomalies, findArbitrage)
- [ ] `lib/ai/agents/arbitrage/gemini-agent.ts`
- [ ] `app/api/agents/arbitrage/route.ts`
- [ ] Alert dashboard UI (AlertCenter, AlertCard, AlertBadge)
- [ ] Trigger hooks (ingest → arbitrage, cron, manual)

## Task Aktif
Documentation sync: update CLAUDE.md, WORKBENCH.md, buat AGENTS.md.
Next: Split ArbitrasePage.tsx.

## Issues / Blockers
- ArbitrasePage.tsx (756 baris) blocks Phase 2 integration
- constants.ts belum punya PROVINCE_MAP & COMMODITY_CATEGORIES (Phase 2 needs them)

## Reference Docs
- `Project Update/` — archived planning docs (PROJECT_CONTEXT, PHASE1-3_DETAIL, AGENTS)
- AI agent architecture → included in `CLAUDE.md` (bottom section)
