# Agent Instructions — PanganArbitrage V2

> **Version**: 1.1 · **Updated**: 2026-05-01
> **Context**: Read `CLAUDE.md` for project brain. This file = AI agent architecture only.

---

## 1. Code Rules (All Agents Must Follow)

| # | Rule | Severity |
|---|------|----------|
| 1 | **Tailwind only** — utility classes. NO inline `style={{}}`. NO custom CSS. | 🔴 |
| 2 | **No duplication** — check `lib/analytics/metrics.ts` + `lib/constants.ts` first. | 🔴 |
| 3 | **File size** — page >200 lines MUST split to sub-components. | 🔴 |
| 4 | **Pure functions must have tests** — parser, metrics, date, arbitrage. | 🔴 |
| 5 | **Use `useSWR`** — no raw `fetch` in components. Consistent cache keys. | 🟡 |
| 6 | **Error boundaries** — required at every page level. | 🟡 |
| 7 | **AI tools in `lib/ai/tools.ts`** — no hardcoded tool defs in pages/routes. | 🟡 |
| 8 | **Type safety** — no `any`. Recharts props properly typed. | 🟠 |

---

## 2. AI Agent Architecture (Phase 2 + 3)

```
Phase 2 (Gemini Flash only, $0):
└── Arbitrage Agent — statistical + Gemini insight

Phase 3 (Hermes + workers, $20-50/mo):
    Hermes (Claude Sonnet — orchestrator)
    ├── Multi-Scraper      (Gemini Flash Free, cron)
    ├── Analisis            (Gemini Flash Free, per-request)
    ├── Prediksi            (Statistical + Flash, daily)
    └── NLQ                 (Gemini Flash Free, on-demand)
```

---

## 3. Tool Definitions (`lib/ai/tools.ts`) — Phase 2+

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
  getPriceSeries: tool({
    description: "Ambil data harga harian komoditas di kota tertentu",
    parameters: z.object({
      kodeWilayah: z.string().describe("Kode BPS wilayah, e.g. '3171'"),
      commodityId: z.number(),
      days: z.number().default(30)
    }),
    execute: async ({ kodeWilayah, commodityId, days }) => { /* Query Supabase */ }
  }),

  getLatestPrices: tool({
    description: "Ambil harga terbaru semua komoditas di provinsi/island",
    parameters: z.object({
      island: z.enum(['Jawa','Madura','Bali','Lombok']).optional(),
      province: z.string().optional()
    }),
    execute: async ({ island, province }) => { /* RPC get_sp2kp_latest */ }
  }),

  calculateArbitrage: tool({
    description: "Hitung arbitrase antar kota untuk komoditas tertentu",
    parameters: z.object({
      fromCity: z.string(), toCity: z.string(),
      commodityId: z.number(),
      transportMode: z.enum(['truck','ship','train']).optional()
    }),
    execute: async (params) => { /* profit = price_diff - transport_cost */ }
  }),

  detectAnomaly: tool({
    description: "Deteksi anomali harga (di atas HET atau fluktuasi ekstrem)",
    parameters: z.object({
      kodeWilayah: z.string(), commodityId: z.number(),
      threshold: z.number().default(1.02)
    }),
    execute: async (params) => { /* price > HET * threshold */ }
  }),

  getPricePrediction: tool({
    description: "Prediksi harga komoditas di masa depan",
    parameters: z.object({
      kodeWilayah: z.string(), commodityId: z.number(),
      daysAhead: z.number().default(7),
      includeWeather: z.boolean().default(true)
    }),
    execute: async (params) => { /* Exponential smoothing */ }
  }),

  getSentimentAnalysis: tool({
    description: "Analisis sentimen pasar dari news/weather feeds",
    parameters: z.object({
      commodityId: z.number(), daysBack: z.number().default(7)
    }),
    execute: async (params) => { /* NLP sentiment */ }
  }),

  triggerScraper: tool({
    description: "Trigger manual scraper untuk sumber data tertentu",
    parameters: z.object({
      source: z.enum(['sp2kp','bps','weather','news']),
      forceRefresh: z.boolean().default(false)
    }),
    execute: async (params) => { /* Call scraper agent */ }
  })
};
```

---

## 4. System Prompts (`lib/ai/prompts.ts`)

### NLQ Agent (Phase 3)
```
Kamu adalah PanganBot — asisten AI untuk dashboard harga komoditas pangan Indonesia.
Kemampuan: query harga real-time, analisis tren, deteksi anomali, kalkulasi arbitrase,
prediksi harga, analisis sentimen. Selalu gunakan tool, jangan tebak data.
Format harga: Rupiah (Rp 15.000/kg). Bahasa default: Indonesia.
```

### Analisis Agent (Phase 2)
```
Kamu adalah Profit Scout — agent analisis anomali dan arbitrase.
Tugas: (1) Identifikasi harga > HET 2%, (2) Price spread > 10%, 
(3) Hitung arbitrase: profit = price_diff - transport_cost,
(4) Prioritaskan alert: profit margin > confidence > volume.
Output: JSON { alerts[], insights[], recommendedActions[] }
```

### Prediksi Agent (Phase 3)
```
Kamu adalah Oracle — agent prediksi tren harga pangan.
Metodologi: 60% historical + 25% weather + 15% sentiment.
Confidence: ±5% (3 hari), ±12% (7 hari). Sertakan disclaimer.
Output: JSON { forecast[], trend, sentiment, factors[] }
```

---

## 5. Data Flow

```
Phase 2:
  Trigger → fetch prices → detectAnomalies() → findArbitrage()
                         → analyzeWithGemini() → arbitrage_alerts table → Dashboard

Phase 3:
  [Scraper Agents] → prices_* tables → [prices_all VIEW]
                                              ↓
  [Analisis Agent] → arbitrage_alerts → SSE → Dashboard
  [Prediksi Agent] → price_predictions → Dashboard
  [NLQ Agent] ← user query → stream response → ChatPanel
```

---

## 6. Folder Structure (Target)

```
lib/
├── ai/
│   ├── tools.ts              # 7 tool definitions (Zod schema)
│   ├── prompts.ts            # System prompts per agent
│   ├── orchestrator.ts       # Hermes coordination (Phase 3)
│   ├── shared-memory.ts      # Inter-agent scratchpad (Phase 3)
│   ├── resilience.ts         # Circuit breaker (Phase 3)
│   └── agents/
│       ├── arbitrage/        # Phase 2
│       │   ├── gemini-agent.ts
│       │   ├── prompts.ts
│       │   └── types.ts
│       ├── scraper/          # Phase 3
│       ├── prediksi/         # Phase 3
│       └── nlq/              # Phase 3
├── analytics/
│   ├── metrics.ts            # Existing
│   └── arbitrage.ts          # Phase 2 — detectAnomalies, findArbitrage
└── constants.ts              # HET_THRESHOLD, PROVINCE_MAP, etc.

app/api/
├── agents/
│   ├── arbitrage/route.ts    # Phase 2
│   ├── scraper/route.ts      # Phase 3
│   └── prediksi/route.ts     # Phase 3
└── chat/route.ts             # Phase 3 — NLQ

components/ai/                # Phase 3
├── ChatPanel.tsx
├── SuggestionChips.tsx
└── AgentStatusBadge.tsx
```

---

## 7. Infrastructure (All Free Except Claude)

| Component | Provider | Cost |
|-----------|----------|------|
| Database | Supabase Free | $0 |
| VPS (Hermes) | Oracle Cloud Always Free | $0 |
| Frontend | Vercel Hobby | $0 |
| Cron | GitHub Actions | $0 |
| AI Workers | Gemini Flash Free | $0 |
| Orchestrator | Claude Sonnet | $20-50/mo |

---

*This file is the AI agent reference. For project brain, see CLAUDE.md.*
