# PanganArbitrage V2 — Project Brain

> **Updated**: 2026-05-01 · Stack: Next.js 14 App Router · TypeScript · Supabase · Tailwind 3 · Recharts
> Deploy: Vercel Hobby ($0) · AI: Gemini Flash ($0) + Claude Sonnet ($20-50/mo Phase 3)

## ⚠️ WAJIB: Baca & Update WORKBENCH.md

> **SEBELUM mulai kerja**: Baca `.claude/WORKBENCH.md` — berisi task aktif, debt list, blockers.
> **SETELAH selesai kerja**: Update WORKBENCH.md — checklist item yang sudah dikerjakan.
> **SETELAH satu fase clear**: Baca WORKBENCH.md fase berikutnya untuk tahu apa yang harus dikerjakan.
> **JANGAN skip** — ini single source of truth untuk progress tracking.

---

## Project Scope

Dashboard harga komoditas pangan RI (Jawa, Madura, Bali, Lombok).
- **Phase 1**: SP2KP data pipeline + dashboard (✅ ~85% done, debt sisa)
- **Phase 2**: AI arbitrage detection — Gemini Flash, $0 (🟡 next, blocked by debt)
- **Phase 3**: Full agentic system — Hermes + 4 workers, $20-50/mo (⚪ planned)

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

## Phase 1: Data Foundation

### SP2KP Parser (`lib/csv/sp2kp-parser.ts`)
- Support XLSX dan CSV. Binary vs text (magic bytes). UTF-8/UTF-16 LE/BOM.
- Strip trailing space: `'Komoditas '`, `'HET/HA '`.
- Scope: `31`–`36` (Jawa), `51` (Bali), `52` (NTB → Lombok only). Madura: `3526`–`3529`.
- **Skala**: SP2KP simpan dalam RIBU — `35` = Rp 35.000. Parser × 1000 sekali.
- HET/HA: ~9% null = normal. Tanggal: `DD/MM/YYYY` → `YYYY-MM-DD`.

### Database
- `prices_raw`: UNIQUE(date, city_raw, commodity_raw, source). Bulk RPC insert.
- `cities`: auto-seeded dari kode_wilayah. Phase 2 cross-source canonicalization.
- `transport_vendors`: biaya transport untuk kalkulasi arbitrase.
- `commodities`: 17 komoditas SP2KP (seeded).
- RPCs: `get_sp2kp_latest()`, `bulk_insert_sp2kp_prices()`, `auto_seed_cities()`.
- 13 migrations (001–013).

### Constants — `lib/constants.ts`
```
PRICE_SCALE=1000  HET_ANOMALY_THRESHOLD=1.02  TREND_FLAT_THRESHOLD=0.01
CHART_DAYS_DEFAULT=30  CHART_DAYS_MAX=400  PRICE_LIMIT_PER_QUERY=5000
```

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/csv/preview` | POST | Parse file, return stats (NO insert) |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/prices` | GET | Daily price series for chart |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | CRUD | Transport vendor data |
| `/api/health` | GET | DB diagnostic |

### Component Structure
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

### Styling
- **Tailwind only** — migration selesai 2026-05-01.
- `globals.css`: `@layer components` + `@apply` murni Tailwind.
- Exception: `gridTemplateColumns` (dynamic), pip color (dynamic prop).

### Design Tokens (tailwind.config.ts)
`sp:#1b5e3b` `ped:#4a3728` `up:#166534` `dn:#991b1b` `warn:#78350f`
Paper `#f5f1ea`, ink `#1a1612`. Serif=Fraunces, mono=DM Mono, sans=DM Sans.

### Display Logic
- SP2KP: RPC → client-side group/filter. Metrics via `lib/analytics/metrics.ts`.
- Chart: GET `/api/prices` lazy on expand. Accordion: 1 kota, 1 komoditas.

### 17 Komoditas SP2KP
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras, Tepung Terigu

### Phase 1 → Phase 2 Migration Hooks (Jangan Break)
- `prices_raw.source` — filter 'sp2kp'; Phase 2 adds 'pedagang', 'marketplace'
- `cities.kode_wilayah` — PK for cross-source canonicalization
- `/api/ingest/sp2kp` after insert → will trigger `/api/agents/arbitrage`
- `findArbitrage()` accepts `PricePoint[]` from any source

> **Selesai Phase 1 debt?** → Baca WORKBENCH.md Phase 2 checklist.

---

## Phase 2: AI-Powered Arbitrage Analysis

### Tujuan
Gemini-powered arbitrage detection. Statistical analysis (Layer 1, deterministic) + AI insight (Layer 2, reasoning). Total cost: **$0** (Gemini Flash free tier, 60 RPM).

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

### Constants yang Perlu Ditambah ke `lib/constants.ts`
```typescript
MIN_PROFIT_THRESHOLD = 50000;       // Rp 50k minimum arbitrase
MIN_SPREAD_PERCENT = 0.10;          // 10% minimum spread
PROVINCE_MAP = { '31': 'DKI Jakarta', '32': 'Jawa Barat', ... };
ISLAND_MAP = { '31': 'Jawa', '51': 'Bali', '52': 'Lombok' };
COMMODITY_CATEGORIES = { POKOK: [...], BUMBU: [...], PROTEIN: [...], SAYUR: [...] };
```

### File Baru Phase 2
```
lib/
├── constants.ts                    # Tambah PROVINCE_MAP, COMMODITY_CATEGORIES, MIN_PROFIT
├── analytics/
│   └── arbitrage.ts                # detectAnomalies(), findArbitrage() — pure, testable
└── ai/
    └── agents/
        └── arbitrage/
            ├── gemini-agent.ts     # analyzeWithGemini(), fallback if down
            ├── prompts.ts          # "Profit Scout" system instruction
            └── types.ts            # PricePoint, ArbitrageOpportunity, AnomalyAlert

app/api/
└── agents/
    └── arbitrage/
        └── route.ts                # POST endpoint, chain Layer1 → Layer2

supabase/migrations/
└── 014_arbitrage_alerts.sql        # alerts table + indexes + RLS

components/arbitrage/
├── AlertCenter.tsx                 # List all alerts
├── AlertCard.tsx                   # Single alert display
├── AlertBadge.tsx                  # Unread count in Sidebar
└── AlertFilter.tsx                 # Filter by type/severity
```

### Core Interfaces
```typescript
interface PricePoint {
  kode_wilayah: string; city_name: string;
  commodity_id: number; commodity_name: string;
  price: number; het_ha: number | null; date: string;
}

interface AnomalyAlert {
  type: 'anomaly'; severity: 'high' | 'medium' | 'low';
  commodity: string; city: string; price: number; het_ha: number;
  excess_percent: number; reason: string;
}

interface ArbitrageOpportunity {
  type: 'arbitrage'; severity: 'high' | 'medium' | 'low';
  commodity: string; from_city: string; to_city: string;
  price_spread: number; spread_percent: number;
  profit_estimate: number; transport_cost_estimate: number;
  confidence: number; reason: string;
}
```

### Trigger Mechanism
| Trigger | Kapan | Cara |
|---------|------|------|
| Auto (Ingest) | Setelah CSV upload | fetch `/api/agents/arbitrage` in ingest route |
| Manual | User klik | Button di AlertCenter |
| Cron | 6 jam | vercel.json atau GitHub Actions |

### Gemini Prompt (Profit Scout)
```
Analis arbitrase pangan profesional. Berikan insight strategis.
Fokus: (1) Opportunity terbaik, (2) Anomali kritis,
(3) Faktor penyebab spread, (4) Rekomendasi aksi.
Output JSON: { insights[], recommendedActions[], riskFactors[] }
```

### Phase 2 → Phase 3 Migration
- Extract logic dari `route.ts` ke standalone function `runArbitrageTask()`.
- Phase 2: called by API route. Phase 3: called by Hermes worker.
- `findArbitrage()` sudah multi-source ready (accepts PricePoint[] from any table).

> **Selesai Phase 2?** → Baca WORKBENCH.md Phase 3 checklist.

---

## Phase 3: Full Agentic System

### Tujuan
Hermes orchestration (Claude Sonnet $20-50/mo) + 4 worker agents (Gemini Flash free). Multi-source scraping, prediction, NLQ chat.

### Arsitektur
```
Hermes (Claude Sonnet — orchestrator, $20-50/mo)
├── Multi-Scraper      (Gemini Flash Free, cron 4x/hari)
│   ├── SP2KP API
│   ├── Pedagang app
│   ├── Marketplace (Tokped/Shopee/Blibli)
│   └── External (berita/cuaca)
├── Analisis           (Gemini Flash Free, per-request)
│   ├── Cross-source comparison
│   └── Arbitrage alerts (upgrade Phase 2)
├── Prediksi           (Statistical + Gemini Flash, daily)
│   ├── Exponential smoothing (60% weight)
│   ├── Weather data (25% weight)
│   └── Sentiment analysis (15% weight)
└── NLQ                (Gemini Flash Free, on-demand)
    └── Chat interface (Vercel AI SDK)
```

### Database Baru Phase 3
```sql
prices_pedagang:    +pedagang_id, trust_score, status(pending/approved/rejected)
prices_marketplace: +platform(tokopedia/shopee/blibli), url, seller_location, rating
external_sources:   +source_type(weather/news/policy), entities(JSONB), embedding VECTOR(768)
price_predictions:  +forecast_date, predicted_price, confidence_lower/upper, model_used
agent_logs:         +agent_name, task_type, status, duration_ms
prices_all VIEW:    UNION ALL sp2kp + pedagang(approved) + marketplace
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
  Format Rupiah. Bahasa default: Indonesia.
- **Analisis (Profit Scout)**: HET >2%, spread >10%, profit > Rp50k.
  Output: JSON { alerts[], insights[], recommendedActions[] }
- **Prediksi (Oracle)**: Confidence ±5% (3 hari), ±12% (7 hari). Sertakan disclaimer.
  Output: JSON { forecast[], trend, sentiment, factors[] }

### Data Flow Phase 3
```
[Scraper Agents] → prices_* tables → [prices_all VIEW]
                                           ↓
[Analisis Agent] → arbitrage_alerts → SSE → [Dashboard AlertCenter]
[Prediksi Agent] → price_predictions →      [Dashboard PredictionCard]
[NLQ Agent] ← user query → stream →        [Dashboard ChatPanel]
```

### Target Folder Structure
```
lib/ai/
├── tools.ts              # 7 tool definitions (Zod schema)
├── prompts.ts            # System prompts per agent
├── orchestrator.ts       # Hermes task coordination
├── shared-memory.ts      # Inter-agent scratchpad
├── resilience.ts         # Circuit breaker (3x retry → replan → fallback model)
└── agents/
    ├── arbitrage/        # Phase 2 (upgrade in Phase 3)
    │   ├── gemini-agent.ts, prompts.ts, types.ts
    ├── scraper/          # Phase 3 — detail TBD (Phase 3.1)
    ├── prediksi/         # Phase 3
    │   ├── model.ts      # Exponential smoothing
    │   └── sentiment.ts  # NLP dari news
    └── nlq/              # Phase 3
        ├── intent.ts, router.ts, formatter.ts
```

### Inter-Agent Communication
| Level | Pattern | Use Case |
|-------|---------|----------|
| L0 | Isolated | Simple delegation |
| L1 | Result passing | Scraper → Analisis (data baru) |
| L2 | Shared scratchpad | Prediksi + Analisis share trend |
| L3 | Live dialogue | Debate mode validasi |

### Failure Recovery
```
Retry (3x exponential backoff)
  → Replan (Hermes decompose)
    → Fallback model (DeepSeek/Qwen free)
      → Human escalation
```

### Infrastructure
| Component | Provider | Cost |
|-----------|----------|------|
| Database | Supabase Free | $0 |
| VPS (Hermes) | Oracle Cloud Always Free | $0 |
| Frontend | Vercel Hobby | $0 |
| Cron | GitHub Actions (2,000 min/mo) | $0 |
| AI Workers | Gemini Flash Free (60 RPM) | $0 |
| Orchestrator | Claude Sonnet | **$20-50/mo** |

### Hermes Config
```yaml
orchestrator: anthropic/claude-sonnet-4-20250514
workers:
  multi-scraper: google/gemini-2.5-flash  (cron: "0 */6 * * *")
  analisis:      google/gemini-2.5-flash  (trigger: per_request)
  prediksi:      google/gemini-2.5-flash  (cron: "0 6 * * *")
  nlq:           google/gemini-2.5-flash  (endpoint: /api/chat)
fallback: [deepseek-chat:free, deepseek-r1:free, qwen-2.5-72b:free]
```

> **Selesai Phase 3?** → Update WORKBENCH.md, semua checklist harus ✅.

---

## Reference
- `Project Update/` — archived planning docs (PROJECT_CONTEXT, PHASE1-3_DETAIL)
- `.claude/WORKBENCH.md` — **SELALU baca & update sebelum/sesudah kerja**
