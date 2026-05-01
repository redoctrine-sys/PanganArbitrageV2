# PanganArbitrage V2 — Project Context (Optimized for Claude)

> **Token Budget**: This file replaces project_summary.md + CLAUDE.md for agent context.
> **Rule**: If info exists here, don't repeat in other files.
> **Last Updated**: 2026-05-01

---

## 1. Elevator Pitch

Dashboard harga komoditas pangan RI (Jawa, Madura, Bali, Lombok). 
Phase 1: SP2KP data only. Phase 2: Multi-source (Pedagang, Marketplace, News) + 4 AI Agents.

---

## 2. Stack (One Line)

Next.js 14 App Router · TypeScript · Supabase · Tailwind 3 · Recharts · Vercel AI SDK · Hermes Agent

---

## 3. Database Schema (Minimal)

```sql
-- Core
cities: kode_wilayah(PK), name, province, island, lat, lng
commodities: id, name, unit, category, is_sp2kp
prices_raw: date, city_raw, commodity_raw, price, het_ha, source, kode_wilayah, commodity_id

-- Phase 2 NEW
prices_pedagang: +pedagang_id, trust_score, status
prices_marketplace: +platform, seller_location, url
external_sources: +source_type, entities(JSONB)
agent_logs: agent_name, task_type, status, duration_ms

-- RPCs
get_sp2kp_latest(p_island, p_province) — ranked CTE, SECURITY DEFINER
bulk_insert_sp2kp_prices(p_rows jsonb) — conditional upsert via xmax=0
auto_seed_cities() — derive from prices_raw
```

**Key Constraint**: prices_raw UNIQUE(date, city_raw, commodity_raw, source)

---

## 4. AI Agent Architecture (4 + 1)

```
Hermes(Claude Sonnet $20-50/mo) — Orchestrator
├─ Scraper SP2KP      (Gemini Flash Free, 4x/day)
├─ Scraper Pedagang   (Gemini Flash Free, real-time+batch)
├─ Scraper Marketplace(Gemini Flash Free, hourly)
├─ Scraper External   (Gemini Flash Free, 2x/day)
├─ Analisis           (Gemini Flash Free, hourly) — anomaly + arbitrage
├─ Prediksi           (Statistical + Gemini Flash, daily) — forecast + sentiment
└─ NLQ                (Gemini Flash Free, on-demand) — chat interface
```

**All workers free. Only Claude is paid.**

---

## 5. Business Rules (Hardcoded Constants)

```typescript
// lib/constants.ts — SINGLE SOURCE OF TRUTH
export const HET_ANOMALY_THRESHOLD = 1.02;      // was hardcoded in 6 files
export const MIN_PROFIT_THRESHOLD = 50000;      // Rp 50k for arbitrage
export const PROVINCE_MAP = { /* kode_wilayah → province */ }; // was in 4 files
export const SCRAPER_GROUPS = ['sp2kp','pedagang','marketplace','external'];
export const COMMODITY_CATEGORIES = {
  POKOK: ['beras','gula_pasir','minyak_goreng','tepung_terigu'],
  BUMBU: ['cabai_merah','cabai_rawit','bawang_merah','bawang_putih'],
  PROTEIN: ['daging_sapi','daging_ayam','telur_ayam','ikan'],
  SAYUR: ['kangkung','bayam','wortel','kentang','tomat']
};
```

---

## 6. File Size Limits (For Agent Context)

| File Type | Max Lines | Action if Exceeded |
|-----------|-----------|-------------------|
| Page component | 200 | MUST split to sub-components |
| API route | 150 | Extract logic to lib/ |
| Utility function | 100 | Split by concern |
| Test file | N/A | Every pure function MUST have test |

**Current violations**: ArbitrasePage.tsx (900 lines), VendorTransportPage.tsx (900 lines)

---

## 7. Styling Rules (Strict)

- **Tailwind utilities ONLY**
- NO inline `style={{}}`
- NO custom CSS classes (`.l1-row`, `.pill` → migrate to Tailwind)
- Exception: CSS variables for theming, complex animations

---

## 8. Data Flow (One Diagram)

```
[Source Agent] → parse → normalize → [Supabase table per source]
                                              ↓
[Analisis Agent] ← read all tables ← [prices_all VIEW]
       ↓
[alerts queue] → SSE → [Dashboard]
       ↓
[Prediksi Agent] → forecast → [price_predictions]
       ↓
[NLQ Agent] ← user query → [stream response]
```

---

## 9. Tool Definitions (For NLQ Agent)

```typescript
// lib/ai/tools.ts — 7 tools only
getPriceSeries(kodeWilayah, commodityId, days)
getLatestPrices(island?, province?)
calculateArbitrage(fromCity, toCity, commodityId, transportMode?)
detectAnomaly(kodeWilayah, commodityId, threshold=1.02)
getPricePrediction(kodeWilayah, commodityId, daysAhead, includeWeather)
getSentimentAnalysis(commodityId, daysBack)
triggerScraper(source, forceRefresh)
```

---

## 10. Infrastructure (All Free Except Claude)

| Component | Provider | Cost | Limit |
|-----------|----------|------|-------|
| Database | Supabase Free | $0 | 500MB (~5 years data) |
| VPS (Hermes) | Oracle Cloud Always Free | $0 | 2 vCPU, 1GB RAM, forever |
| Frontend | Vercel Hobby | $0 | 10s timeout (use Edge 30s) |
| Cron | GitHub Actions | $0 | 2,000 min/month |
| AI Workers | Gemini Flash | $0 | 60 RPM |
| Orchestrator | Claude Sonnet | $20-50/mo | Only paid component |

**Cron workaround**: Single `/api/agents/cron` router (Vercel allows 2 cron jobs) that triggers all agents internally. Or use GitHub Actions.

---

## 11. Roadmap (8 Weeks)

| Week | Focus | Key Deliverable |
|------|-------|----------------|
| 1-2 | Foundation | Split god components, extract constants, add tests |
| 2-3 | Hermes Setup | Oracle VPS, install, shared memory |
| 3-4 | Multi-Scraper | 4 source agents, cron, circuit breaker |
| 4-5 | Analisis | Cross-source comparison, arbitrage alerts |
| 5-6 | Prediksi | Exponential smoothing, weather, sentiment |
| 6-7 | NLQ | Chat UI, intent classification, tool routing |
| 7-8 | Polish | Auth, skeletons, performance |

---

## 12. When Updating This File

**DO**: 
- Add new constants to Section 5
- Update schema changes to Section 3
- Mark completed roadmap items

**DON'T**:
- Duplicate info from this file to CLAUDE.md or workbench.md
- Add verbose explanations — link to external docs instead
- Include code snippets > 10 lines — reference file paths

---

*This file is the single source of truth. Keep it under 200 lines for agent efficiency.*
