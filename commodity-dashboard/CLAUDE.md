# PanganArbitrage V2 — Project Brain

> **Updated**: 2026-05-05 · Stack: Next.js 14 App Router · TypeScript · Supabase · Tailwind 3 · Recharts · Gemini Flash
> **Deploy**: Vercel Hobby ($0) · AI: Gemini Flash ($0) · Scraper: GitHub Actions ($0)

## ⚠️ WAJIB: Baca & Update WORKBENCH.md

> **SEBELUM mulai kerja**: Baca `.claude/WORKBENCH.md` — berisi task aktif, debt list, blockers.
> **SETELAH selesai kerja**: Update WORKBENCH.md — checklist item yang sudah dikerjakan.
> **SETELAH satu fase clear**: Baca WORKBENCH.md fase berikutnya untuk tahu apa yang harus dikerjakan.
> **JANGAN skip** — ini single source of truth untuk progress tracking.

---

## Project Scope

Dashboard harga komoditas pangan RI (Jawa, Madura, Bali, Lombok).
- **Phase 1**: SP2KP data pipeline + dashboard (✅ ~90% done)
- **Phase 2**: AI arbitrage detection — Gemini Flash, $0 (✅ ~85% done)
- **Phase 2.5**: Scraper Agents + Route Maker + Quota Alert (🟡 ~10% — next sprint)
- **Phase 3**: Full agentic system — Hermes Orchestrator + Karpathy Loop (⚪ ~5% — spec ready)

---

## AI Model Strategy — Gemini Only ($0)

**Semua AI menggunakan Gemini. Tidak ada DeepSeek.**

```
User Request → Complexity Classifier
  │
  ├─ Low/Medium Complexity → Gemini 2.5 Flash
  │   Use: Orchestrator, Research Agent, Route Planner, Scraper extraction,
  │         Quota Tracking, Arbitrage Layer 2, Paskomnas/PIHPS normalization
  │
  └─ High Complexity / Fallback → Gemini 2.5 Pro (or Gemini 1.5 Flash)
      Use: Karpathy experiment agent, Validator agent, critical reasoning
```

| Model | Cost | Use |
|-------|------|-----|
| **Gemini 2.5 Flash** | $0 (free tier, 60 RPM) | Primary — semua agents, scraper, orchestrator |
| **Gemini 2.5 Pro** | $0 free tier | Fallback — reasoning berat, experiment agent |
| **Gemini 1.5 Flash** | $0 free tier | Secondary fallback |

> **No DeepSeek. No Claude/Anthropic.** Semua AI calls → `@google/generative-ai` SDK.

### Wrapper File
- `lib/ai/gemini-wrapper.ts` — quota tracking + smart cache + graceful fallback
- `lib/ai/model-router.ts` — complexity classifier → Flash vs Pro
- `lib/ai/gemini-cache.ts` — smart cache per (commodity, cities) pair

---

## Code Rules (Wajib)

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

## Phase 1: Data Foundation ✅ ~90%

### SP2KP Parser (`lib/csv/sp2kp-parser.ts`)
- Support XLSX dan CSV. Binary vs text (magic bytes). UTF-8/UTF-16 LE/BOM.
- Strip trailing space: `'Komoditas '`, `'HET/HA '`.
- Scope: `31`–`36` (Jawa), `51` (Bali), `52` (NTB → Lombok only). Madura: `3526`–`3529`.
- **Skala**: SP2KP simpan dalam RIBU — `35` = Rp 35.000. Parser × 1000 sekali.
- HET/HA: ~9% null = normal. Tanggal: `DD/MM/YYYY` → `YYYY-MM-DD`.

### Database (25 migrations, 001–025)
- `prices_raw`: UNIQUE(date, city_raw, commodity_raw, source). Bulk RPC insert.
- `cities`: auto-seeded dari kode_wilayah.
- `transport_vendors`: biaya transport untuk kalkulasi arbitrase.
- `commodities`: 17 komoditas SP2KP (seeded).
- `arbitrage_alerts`: AI-detected opportunities + anomalies.
- `api_usage_log`: Gemini quota tracking (migration 022).
- `transport_edges`, `transfer_points`, `route_calculations`: Route Maker (migration 023).
- `ai_insight_cache`: Smart cache per commodity+cities (migration 024).
- `agent_memory`, `experiment_log`, `workflow_checkpoint`: Agentic system (migration 025).

### API Routes (Lengkap)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/csv/preview` | POST | Parse file, return stats (NO insert) |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/prices` | GET | Daily price series for chart |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest + lat/long |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | CRUD | Transport vendor management |
| `/api/agents/arbitrage` | POST | Run arbitrage detection (L1+L2) |
| `/api/route-maker/calculate` | POST | Multi-modal route optimization (Dijkstra/A*) |
| `/api/quota/status` | GET | Real-time Gemini quota check |
| `/api/quota/daily` | GET | Daily API usage summary |
| `/api/agents/orchestrate` | POST | Trigger Hermes workflow DAG |
| `/api/agents/experiment` | POST | Trigger Karpathy experiment ratchet |
| `/api/agents/memory` | GET/POST | Read/write agent shared memory |
| `/api/health` | GET | DB diagnostic |

### 17 Komoditas SP2KP
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras, Tepung Terigu

### Design Tokens (tailwind.config.ts)
`sp:#1b5e3b` `ped:#4a3728` `up:#166534` `dn:#991b1b` `warn:#78350f`
Paper `#f5f1ea`, ink `#1a1612`. Serif=Fraunces, mono=DM Mono, sans=DM Sans.

---

## Phase 2: AI-Powered Arbitrage ✅ ~85%

### Arsitektur 2 Layer
```
Trigger (Ingest/Cron/Manual)
    → Fetch prices (RPC get_sp2kp_latest)
    → LAYER 1: Statistical Analysis (TypeScript, deterministic)
        detectAnomalies() — price > HET × 1.02
        findArbitrage()   — price spread > 10%, profit > Rp 50k
    → LAYER 2: Gemini Flash (reasoning, narasi)
        analyzeWithGemini() — insights + recommended actions
    → Store → arbitrage_alerts table
    → Dashboard / SSE push
```

### File Structure Phase 2
```
lib/analytics/
├── arbitrage.ts          (564 lines — core engine, ⭐ tested)
├── arbitrage.test.ts     (130 lines — 20 unit tests ✅)
├── metrics.ts            (utility functions)
└── metrics.test.ts       (unit tests)

lib/ai/
├── gemini-wrapper.ts     (quota + cache + fallback)
├── model-router.ts       (Flash vs Pro classifier)
└── gemini-cache.ts       (smart cache per commodity+cities)

components/arbitrase/     (16 files, AlertCard split ✅)
├── AlertCard.tsx         (79L — thin orchestrator)
├── alert-card.types.ts   (Alert discriminated union)
├── ArbitrageSummary.tsx  (91L)
├── LogisticsRiskPanel.tsx (85L — ETA/weight-loss/spread)
├── AIInsightsPanel.tsx   (46L — Gemini insights)
└── ... (8 sub-components total)
```

### Phase 2 → Phase 2.5 Migration Hooks
- `prices_raw.source` field → multi-source ready ('sp2kp', 'pihps', 'paskomnas', 'facebook')
- `api_usage_log` → Gemini quota tracking ready
- `arbitrage_alerts` → Route Maker dapat baca alert ini untuk kalkulasi rute

---

## Phase 2.5: Scraper Agents + Route Maker + Quota Alert 🟡 ~10%

### Scraper Agent Framework (pangan-scraper/ repo terpisah)
```
pangan-scraper/
├── shared/
│   ├── browser.ts         (Playwright + stealth)
│   ├── normalizer.ts      (Gemini Flash price normalization)
│   ├── supabase.ts        (DB client + upsert ke prices_raw)
│   ├── logger.ts          (scrape_runs logging)
│   └── types.ts           (ScrapedPrice interface)
├── agents/
│   ├── pihps.ts           (Agent 1: Bank Indonesia)
│   ├── paskomnas.ts       (Agent 2: Wholesale B2B)
│   └── facebook/          (Agent 3: Chrome Extension MV3)
│       ├── manifest.json
│       ├── content-script.ts
│       ├── popup.html
│       └── background.ts
└── .github/workflows/scrape.yml  (cron: 4×/day)
```

### ScrapedPrice Interface
```typescript
interface ScrapedPrice {
  source: string;           // "pihps" | "paskomnas" | "facebook"
  commodity_raw: string;    // Raw name from source
  price: number;            // Normalized to Rp (actual, not /1000)
  unit: string;             // "kg" (always normalized)
  city_raw: string;         // City/location name
  date: string;             // YYYY-MM-DD
  market_name?: string;
  original_price?: number;
  original_unit?: string;   // e.g., "100g", "pack", "ikat"
  confidence: number;       // Gemini normalization confidence (0-1)
}
// Maps to prices_raw via source field
```

### Agent 1: PIHPS (Bank Indonesia)
- **URL**: `bi.go.id/hargapangan`
- **Method**: Playwright (JS-rendered) + **Gemini Flash** (extraction)
- **Schedule**: GitHub Actions cron 4×/day (06:00, 12:00, 18:00, 00:00 WIB)
- **Coverage**: 82 kota × 11 komoditas = ~900 price points/run
- **Cross-check value**: ⭐⭐⭐ (independent govt agency — BI vs Kemendag)
- **Effort**: ~3 days

### Agent 2: Paskomnas (Wholesale B2B)
- **URL**: `paskomnas.id`
- **Method**: Playwright/HTTP + minimal **Gemini Flash** (structured HTML)
- **Schedule**: 1×/day (06:00 WIB)
- **Coverage**: ~50-100 products, Jabodetabek, Sayur/Buah/Bumbu/Daging
- **Cross-check value**: ⭐⭐ (wholesale benchmark)
- **Effort**: ~2 days

### Agent 3: Facebook Price Extension (Chrome MV3)
- **Type**: Chrome Extension, content script passive
- **Method**: MutationObserver + **Gemini Flash** AI extraction
- **Price regex**: `/Rp\.?\s*[\d.,]+(?:\s*(?:rb|ribu|\/kg|\/ikat|\/pack))?/gi`
- **Output**: POST `/api/scraper/ingest` → prices_raw (source: "facebook")
- **Effort**: ~1 week

### Route Maker (Phase 2.5)
- **Algorithm**: Dijkstra/A* multi-modal graph
- **Tables**: `transport_edges`, `transfer_points`, `route_calculations`
- **Ferry data**: ASDP — Ketapang-Gilimanuk, Padangbai-Lembar
- **API**: `POST /api/route-maker/calculate`
- **Output per leg**: cost, duration, weight_loss, reliability_score
- **Effort**: ~1 week

### Gemini Quota Alert
- **Tables**: `api_usage_log`, daily view `api_usage_daily`
- **Thresholds**: warning banner at 80%, block at 95%, graceful fallback to Layer 1
- **API**: `GET /api/quota/status`, `GET /api/quota/daily`
- **UI**: `QuotaAlertBanner` in dashboard layout

---

## Phase 3: Full Agentic System ⚪ ~5%

### Hermes Orchestrator (Gemini Flash — $0)
```
Hermes (Gemini Flash — orchestrator, $0)
├── Research Agent    (Gemini Flash — scrape + analyze)
├── Experiment Agent  (Gemini Flash — modify + evaluate, Karpathy loop)
├── Validator Agent   (Gemini Flash — review + approve)
└── Route Planner Agent (Gemini Flash — Dijkstra/A*)
```

> **Catatan**: Blueprint v3 awalnya menyebut DeepSeek. Keputusan: **semua diganti Gemini Flash**
> karena (1) $0 cost, (2) satu SDK, (3) sudah digunakan di Phase 1-2, (4) free tier cukup.

### Karpathy Experiment Loop
- **Editable asset**: `lib/analytics/arbitrage.ts`
- **Scalar metric**: `precision_at_k` (alert accuracy)
- **Cycle**: 10-min time-boxed, git keep/reset
- **Agent**: Experiment Agent (Gemini Flash) → hypothesis → modify → measure → commit/revert

### Shared Memory (L0–L3)
| Level | Pattern | Use Case |
|-------|---------|----------|
| L0 | Isolated | Simple delegation |
| L1 | Result passing | Scraper → Analisis (data baru) |
| L2 | Shared scratchpad | Prediksi + Analisis share trend |
| L3 | Live dialogue | Debate mode validasi |

### Infrastructure (All $0)
| Component | Provider | Cost |
|-----------|----------|------|
| Database | Supabase Free | $0 |
| Frontend | Vercel Hobby | $0 |
| Cron / Scraper | GitHub Actions (2,000 min/mo) | $0 |
| All AI | Gemini Flash (60 RPM free) | $0 |
| Orchestrator | Gemini Flash | $0 |
| Chrome Extension | Manual install | $0 |

### Hermes Config (Updated: Gemini Only)
```yaml
orchestrator: google/gemini-2.5-flash
workers:
  research:    google/gemini-2.5-flash  (on-demand)
  experiment:  google/gemini-2.5-flash  (trigger: /api/agents/experiment)
  validator:   google/gemini-2.5-flash  (trigger: post-experiment)
  route-planner: google/gemini-2.5-flash (trigger: /api/route-maker/calculate)
fallback: google/gemini-1.5-flash       # rate-limit fallback only
```

---

## Source Code Structure (75 files)

```
src/
├── app/
│   ├── globals.css                          (201 lines — design system)
│   ├── api/
│   │   ├── agents/arbitrage/route.ts        (197 lines — AI pipeline)
│   │   ├── agents/orchestrate/route.ts      (Hermes DAG executor)
│   │   ├── agents/experiment/route.ts       (Karpathy loop trigger)
│   │   ├── agents/memory/route.ts           (Shared memory CRUD)
│   │   ├── quota/status/route.ts            (Gemini quota check)
│   │   ├── quota/daily/route.ts             (daily usage summary)
│   │   └── route-maker/calculate/route.ts   (route optimization)
│   └── dashboard/
│       ├── sp2kp/page.tsx
│       ├── arbitrase/page.tsx
│       ├── route-maker/page.tsx
│       └── agentic/page.tsx                 (agent dashboard)
├── components/
│   ├── agentic/     (AgentDashboard, ExperimentLogViewer, MemoryInspector)
│   ├── arbitrase/   (16 files — AlertCard split ✅)
│   ├── layout/      (Sidebar, Topbar, ErrorBoundary, QuotaAlertBanner)
│   └── sp2kp/       (7 files — dual view by City/Commodity)
└── lib/
    ├── analytics/arbitrage.ts               (564 lines ⭐ core engine)
    ├── ai/
    │   ├── gemini-wrapper.ts                (primary: quota + cache)
    │   ├── model-router.ts                  (Flash vs Pro)
    │   └── gemini-cache.ts                  (smart cache)
    ├── agents/
    │   ├── orchestrator.ts                  (Hermes DAG executor)
    │   ├── experiment-loop.ts               (Karpathy ratchet)
    │   └── roles/                           (4 specialist agents)
    └── route-maker/
        ├── graph.ts                         (Dijkstra/A*)
        └── asdp-seed.ts                     (ASDP ferry data)
```

---

## Reference
- `Project Update/` — archived planning docs (blueprint_summary_review_v3.md latest)
- `.claude/WORKBENCH.md` — **SELALU baca & update sebelum/sesudah kerja**
- Blueprint v3 source: `Project Update/blueprint_summary_review_v3.md`
