# Phase 3: Full Agentic System

> **Status**: PLANNED  
> **Goal**: Hermes orchestration, multi-source scrapers, predictive analytics  
> **Cost**: $20-50/mo (Claude Sonnet only, rest free)  
> **Token Budget**: <250 lines

---

## 1. Architecture

```
Hermes (Claude Sonnet $20-50/mo)
├── Multi-Scraper          (Gemini Flash Free, Cron/Manual)
│   └── Detail: Phase 3.1 (TBD)
├── Agent Analisis         (Gemini Flash Free, PER REQUEST)
├── Agent Prediksi         (Statistical + Gemini Flash, Daily)
└── Agent NLQ              (Gemini Flash Free, On-demand)
    ↓
Supabase (Data Lake + Vector DB)
    ↓
Dashboard (Next.js + Vercel Hobby)
```

---

## 2. Agent Specs

| Agent | Trigger | Input | Output | Model |
|-------|---------|-------|--------|-------|
| **Multi-Scraper** | Cron / Manual | Multiple sources | prices_* tables | Gemini Flash Free |
| **Analisis** | **Per request** | prices_all VIEW | arbitrage_alerts | Gemini Flash Free |
| **Prediksi** | Cron daily 6AM | Historical + weather + sentiment | price_predictions | Statistical + Flash |
| **NLQ** | On-demand | User query | Stream response | Gemini Flash Free |

### Analisis: Per Request (Not Hourly)

| Aspek | Hourly | Per Request |
|-------|--------|-------------|
| Resource | Boros (tiap jam) | Efisien (saat perlu) |
| Real-time | Tunggu jam berikutnya | Instant saat buka dashboard |
| Cost | Mahal | Murah |
| Control | Otomatis, spam risk | User-triggered, relevant |

**Triggers**:
- User buka dashboard → auto-analisis jika data baru
- User klik "Analisis Sekarang" → force re-analisis
- Setelah ingest baru → auto-trigger sekali

---

## 3. Hermes Configuration

```yaml
# ~/.hermes/profiles/panganarbitrage/config.yaml
project_dir: /path/to/PanganArbitrageV2

orchestrator:
  model: anthropic/claude-sonnet-4-20250514
  provider: anthropic
  max_turns: 10

workers:
  multi-scraper:
    model: google/gemini-2.5-flash
    provider: google-ai-studio
    cron: "0 */6 * * *"
    # Detail: Phase 3.1

  analisis:
    model: google/gemini-2.5-flash
    provider: google-ai-studio
    trigger: per_request

  prediksi:
    model: google/gemini-2.5-flash
    provider: google-ai-studio
    cron: "0 6 * * *"

  nlq:
    model: google/gemini-2.5-flash
    provider: google-ai-studio
    endpoint: "/api/chat"

fallback:
  enabled: true
  models:
    - deepseek/deepseek-chat:free
    - deepseek/deepseek-r1:free
    - qwen/qwen-2.5-72b-instruct:free
```

---

## 4. Database Schema

```sql
-- Phase 2 existing: arbitrage_alerts

-- NEW: Multi-source prices
CREATE TABLE prices_pedagang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  pedagang_id UUID REFERENCES pedagang_profiles(id),
  commodity_id INT REFERENCES commodities(id),
  kode_wilayah TEXT REFERENCES cities(kode_wilayah),
  price DECIMAL NOT NULL,
  quantity_kg DECIMAL,
  trust_score DECIMAL DEFAULT 0.5 CHECK (trust_score >= 0 AND trust_score <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prices_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tokopedia','shopee','blibli')),
  commodity_id INT REFERENCES commodities(id),
  product_name TEXT NOT NULL,
  price DECIMAL NOT NULL,
  original_price DECIMAL,
  discount_percent DECIMAL,
  url TEXT,
  seller_location TEXT,
  rating DECIMAL,
  review_count INT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('weather','news','policy')),
  source_url TEXT,
  title TEXT,
  content TEXT,
  entities JSONB,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Predictions
CREATE TABLE price_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id INT REFERENCES commodities(id),
  kode_wilayah TEXT REFERENCES cities(kode_wilayah),
  forecast_date DATE NOT NULL,
  predicted_price DECIMAL NOT NULL,
  confidence_lower DECIMAL,
  confidence_upper DECIMAL,
  confidence_percent INT,
  model_used TEXT,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW: Agent logs
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started','completed','failed','retried')),
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified view
CREATE VIEW prices_all AS
SELECT 'sp2kp' as source, date, commodity_id, kode_wilayah, price, created_at
FROM prices_raw
UNION ALL
SELECT 'pedagang', date, commodity_id, kode_wilayah, price, created_at
FROM prices_pedagang WHERE status = 'approved'
UNION ALL
SELECT 'marketplace', date, commodity_id, NULL, price, scraped_at
FROM prices_marketplace;
```

---

## 5. Folder Structure

```
lib/
├── ai/
│   ├── tools.ts
│   ├── prompts.ts
│   ├── orchestrator.ts
│   ├── shared-memory.ts
│   ├── embeddings.ts
│   ├── resilience.ts
│   └── agents/
│       ├── scraper/
│       │   └── README.md         # Detail: Phase 3.1
│       ├── analisis/
│       │   ├── arbitrage.ts
│       │   └── cross-source.ts
│       ├── prediksi/
│       │   ├── model.ts
│       │   └── sentiment.ts
│       └── nlq/
│           ├── intent.ts
│           ├── router.ts
│           └── formatter.ts
│
app/
└── api/
    ├── chat/route.ts
    └── agents/
        ├── scraper/
        │   └── README.md         # Detail: Phase 3.1
        ├── analisis/route.ts
        ├── prediksi/route.ts
        └── health/route.ts

components/
└── ai/
    ├── ChatPanel.tsx
    ├── SuggestionChips.tsx
    ├── AgentStatusBadge.tsx
    └── PredictionCard.tsx
```

---

## 6. Inter-Agent Communication

| Level | Pattern | Use Case |
|-------|---------|----------|
| **L0** | Isolated | Simple delegation |
| **L1** | Result passing | Multi-Scraper → Analisis (data baru) |
| **L2** | Shared scratchpad | Prediksi + Analisis share trend |
| **L3** | Live dialogue | Debate mode validasi |

```typescript
// lib/ai/shared-memory.ts
interface SharedMemory {
  latestPrices: Record<string, PricePoint[]>;
  latestAlerts: ArbitrageAlert[];
  trendCache: Record<string, TrendAnalysis>;
  sentimentCache: Record<string, SentimentScore>;
  activeDebates: Record<string, DebateSession>;
}
```

---

## 7. Failure Recovery

```
Retry (3x exponential backoff)
  → Replan (Hermes decompose)
    → Fallback model (DeepSeek/Qwen)
      → Human escalation
```

```typescript
// lib/ai/resilience.ts
class CircuitBreaker {
  failures = 0; threshold = 5; timeout = 60000;
  execute(task) {
    if (this.isOpen()) throw 'Circuit OPEN';
    try { return task(); }
    catch { this.failures++; throw; }
  }
}
```

---

## 8. Infrastructure

| Component | Provider | Cost |
|-----------|----------|------|
| Database | Supabase Free | $0 |
| VPS (Hermes) | Oracle Cloud Always Free | $0 |
| Frontend | Vercel Hobby | $0 |
| Cron | GitHub Actions | $0 |
| AI Workers | Gemini Flash Free | $0 |
| Orchestrator | Claude Sonnet | **$20-50/mo** |
| **Total** | | **$20-50/mo** |

---

## 9. Implementation Order

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Hermes setup | Oracle VPS, install, config |
| 2-3 | Multi-Scraper skeleton | Cron, circuit breaker, placeholder |
| 3-4 | Analisis per-request | On-demand trigger, API route |
| 4-5 | City canonicalization | Mapping table |
| 5-6 | Prediksi agent | Exponential smoothing, weather |
| 6-7 | NLQ agent | Chat UI, intent, tool routing |
| 7-8 | Multi-Scraper detail | SP2KP + Pedagang + Marketplace + External |
| 8-10 | Vector DB + Polish | pgvector, auth, monitoring |

---

## 10. Phase 3.1: Multi-Scraper Detail (TBD)

**Status**: Not yet defined  
**Decision**: By Source (SP2KP, Pedagang, Marketplace, External) vs By Komoditas  
**Blocker**: Need clarification on:
- API availability per source
- Authentication requirements
- Rate limits
- Data format heterogeneity

**Placeholder**: `lib/ai/agents/scraper/README.md`

---

## 11. Success Criteria

- [ ] Multi-Scraper running (sources TBD)
- [ ] Analisis on-demand < 3 detik
- [ ] Prediksi 7-day confidence > 70%
- [ ] NLQ answers 90% questions
- [ ] System uptime > 99%
- [ ] Auto-recovery from failure

---

*Phase 3: Hermes orchestration. Multi-Scraper detail: Phase 3.1. Analisis: per-request.*
