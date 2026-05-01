# Phase 2: AI-Powered Arbitrage Analysis

> **Status**: IN PROGRESS  
> **Goal**: Gemini-powered arbitrage detection, ready for Phase 3 Hermes orchestration  
> **Token Budget**: <200 lines for agent context  
> **Cost**: $0 (Gemini Flash Free tier)

---

## 1. Data Flow

```
Trigger (Ingest/Cron/Manual)
    → Fetch prices (RPC get_sp2kp_latest)
    → LAYER 1: Statistical Analysis (TypeScript, deterministic)
    → LAYER 2: Gemini Insight (reasoning, narasi)
    → Store to arbitrage_alerts
    → Dashboard / SSE Push
```

---

## 2. Architecture

```
┌─────────────────────────────────────────┐
│  LAYER 1: Statistical (Fast, $0)        │
│  lib/analytics/arbitrage.ts             │
│  • detectAnomalies() — HET threshold    │
│  • findArbitrage() — price spread       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  LAYER 2: Gemini (Insight, Free)        │
│  lib/ai/agents/arbitrage/gemini-agent.ts│
│  • analyzeWithGemini()                  │
│  • Risk factor identification           │
│  • Recommended actions                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  OUTPUT: arbitrage_alerts table         │
│  • type: arbitrage | anomaly            │
│  • severity: high | medium | low        │
│  • insights[] — from Gemini             │
│  • recommended_actions[] — from Gemini  │
└─────────────────────────────────────────┘
```

---

## 3. New Files

```
lib/
├── constants.ts                    # Extracted from Phase 1
│   ├── HET_ANOMALY_THRESHOLD = 1.02
│   ├── MIN_PROFIT_THRESHOLD = 50000
│   ├── MIN_SPREAD_PERCENT = 0.10
│   ├── PROVINCE_MAP
│   └── COMMODITY_CATEGORIES
│
├── analytics/
│   ├── arbitrage.ts                # Pure functions (testable)
│   │   ├── detectAnomalies(prices, threshold?)
│   │   ├── findArbitrage(prices, transportCost?)
│   │   └── interfaces: PricePoint, ArbitrageOpportunity, AnomalyAlert
│   └── metrics.ts                  # Existing (keep)
│
└── ai/
    └── agents/
        └── arbitrage/
            ├── gemini-agent.ts     # Gemini Flash integration
            ├── types.ts            # GeminiAnalysisResult
            └── prompts.ts          # System instruction

app/
└── api/
    └── agents/
        └── arbitrage/
            └── route.ts            # POST endpoint

supabase/
└── migrations/
    └── 015_arbitrage_alerts.sql
```

---

## 4. Core Functions

### 4.1 Statistical Layer (lib/analytics/arbitrage.ts)

```typescript
// Input
interface PricePoint {
  kode_wilayah: string; city_name: string;
  commodity_id: number; commodity_name: string;
  price: number; het_ha: number | null; date: string;
}

// Outputs
interface AnomalyAlert {
  type: 'anomaly'; severity: 'high' | 'medium' | 'low';
  commodity: string; city: string; kode_wilayah: string;
  price: number; het_ha: number; excess_percent: number;
  reason: string;
}

interface ArbitrageOpportunity {
  type: 'arbitrage'; severity: 'high' | 'medium' | 'low';
  commodity: string; from_city: string; to_city: string;
  from_kode: string; to_kode: string;
  price_spread: number; spread_percent: number;
  profit_estimate: number; transport_cost_estimate: number;
  confidence: number; reason: string;
}

// Algorithms
detectAnomalies(prices, threshold = HET_ANOMALY_THRESHOLD)
  → Filter price > het_ha * threshold
  → Sort by excess_percent DESC

findArbitrage(prices, transportCostPerKm = 500)
  → Group by commodity_id
  → For each: sort by price, check cheapest vs most expensive
  → If spread_percent > MIN_SPREAD_PERCENT:
       profit = spread - (500km * transportCostPerKm)
       If profit > MIN_PROFIT_THRESHOLD → opportunity
  → Sort by profit_estimate DESC
```

### 4.2 Gemini Layer (lib/ai/agents/arbitrage/gemini-agent.ts)

```typescript
// Input: statistical results + raw prices
// Output: insights + recommended_actions

analyzeWithGemini(prices, opportunities, anomalies)
  → Build context (top 3 opportunities, top 3 anomalies, commodity summary)
  → Call Gemini 2.5 Flash with system instruction
  → Parse JSON response
  → Fallback to statistical-only if Gemini fails

// System Instruction
"Analis arbitrase pangan profesional. Berikan insight strategis.
Fokus: (1) Opportunity terbaik, (2) Anomali kritis, (3) Faktor spread, (4) Rekomendasi aksi."

// Response Format (JSON)
{
  insights: ["string"],
  recommendedActions: ["string"],
  riskFactors: ["string"]
}
```

---

## 5. API Route (app/api/agents/arbitrage/route.ts)

```typescript
POST /api/agents/arbitrage
  Body: { date?: string }

  Steps:
  1. Fetch latest prices (RPC get_sp2kp_latest)
  2. Transform to PricePoint[]
  3. Statistical analysis (detectAnomalies + findArbitrage)
  4. Gemini analysis (if opportunities or anomalies found)
  5. Insert to arbitrage_alerts
  6. Return { opportunities, anomalies, insights }

  Error: Return 500 with fallback to statistical results
```

---

## 6. Database (Migration 015)

```sql
CREATE TABLE arbitrage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('arbitrage', 'anomaly')),
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  commodity TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT,
  price_spread DECIMAL,
  profit_estimate DECIMAL,
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),
  reason TEXT NOT NULL,
  insights TEXT[],                    -- From Gemini
  recommended_actions TEXT[],         -- From Gemini
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_arbitrage_alerts_unread ON arbitrage_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_arbitrage_alerts_commodity ON arbitrage_alerts(commodity);
CREATE INDEX idx_arbitrage_alerts_created ON arbitrage_alerts(created_at DESC);

ALTER TABLE arbitrage_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read arbitrage alerts" ON arbitrage_alerts FOR SELECT USING (true);
```

---

## 7. Trigger Mechanism

| Trigger | When | How |
|---------|------|-----|
| **Auto (Ingest)** | After CSV upload | `fetch('/api/agents/arbitrage')` in `/api/ingest/sp2kp/route.ts` |
| **Cron** | Every 6 hours | `vercel.json`: `"0 */6 * * *"` or GitHub Actions |
| **Manual** | User click | Button in dashboard |

```typescript
// In /api/ingest/sp2kp/route.ts — after successful insert
try {
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agents/arbitrage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: new Date().toISOString().split('T')[0] })
  });
} catch (e) {
  console.error('Arbitrage trigger failed:', e);
  // Don't fail ingest if trigger fails
}
```

---

## 8. Dashboard Integration

### New Components
```
components/
└── arbitrage/
    ├── AlertCenter.tsx           # List all alerts
    ├── AlertCard.tsx             # Single alert display
    ├── AlertBadge.tsx            # Unread count in sidebar
    └── AlertFilter.tsx           # Filter by type/severity/commodity
```

### Data Fetching
```typescript
// Use SWR for caching
const { data: alerts } = useSWR('/api/agents/arbitrage?unread=true', fetcher);

// Or Supabase realtime
supabase
  .channel('arbitrage-alerts')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arbitrage_alerts' }, callback)
  .subscribe();
```

---

## 9. Phase 2 → Phase 3 Migration Points

### Ready for Hermes Orchestration
| Component | Phase 2 | Phase 3 Change |
|-----------|---------|----------------|
| `lib/analytics/arbitrage.ts` | Called directly | Wrapped by Hermes task |
| `lib/ai/agents/arbitrage/gemini-agent.ts` | Direct API call | Called via Hermes worker |
| `app/api/agents/arbitrage/route.ts` | Next.js API route | Becomes Hermes task handler |
| Trigger (Ingest/Cron) | Direct fetch | Hermes delegates to worker |

### Hermes Integration Prep
```typescript
// Phase 3: Extract logic from route.ts to standalone function
// So Hermes can call it without HTTP request

// lib/ai/tasks/arbitrage-task.ts
export async function runArbitrageTask(date?: string): Promise<ArbitrageResult> {
  // Same logic as route.ts, but exportable function
  const prices = await fetchPrices(date);
  const anomalies = detectAnomalies(prices);
  const opportunities = findArbitrage(prices);
  const geminiResult = await analyzeWithGemini(prices, opportunities, anomalies);
  await storeResults(geminiResult);
  return geminiResult;
}

// Phase 2: Called by API route
// Phase 3: Called by Hermes worker
```

### Multi-Source Prep (Phase 3)
| Phase 2 | Phase 3 Extension |
|---------|-------------------|
| Single source: SP2KP | Multi-source: SP2KP + Pedagang + Marketplace |
| `prices_raw` only | `prices_pedagang`, `prices_marketplace` added |
| `findArbitrage()` uses single table | `findArbitrage()` accepts `PricePoint[]` from any source |
| `source='sp2kp'` hardcoded | `source` parameter passed through |

---

## 10. Model & Cost

| Component | Model | Cost | Why |
|-----------|-------|------|-----|
| Statistical analysis | TypeScript code | $0 | Fast, deterministic, testable |
| Insight generation | Gemini 2.5 Flash | **$0** | Free tier 60 RPM, 97.1% pass rate |
| **Total** | | **$0** | |

**Usage estimate**: 16 calls/day (4x ingest) << 60 RPM limit.

---

## 11. Testing Checklist

| Function | Test Case | Expected |
|----------|-----------|----------|
| `detectAnomalies` | Price = 15000, HET = 10000, threshold = 1.02 | Alert (excess 47%) |
| `detectAnomalies` | Price = 10000, HET = 10000, threshold = 1.02 | No alert |
| `findArbitrage` | City A = 10000, City B = 15000, transport = 2000 | Opportunity (profit = 3000) |
| `findArbitrage` | City A = 10000, City B = 10500, transport = 2000 | No opportunity (profit < 50000) |
| `analyzeWithGemini` | Gemini API down | Fallback to statistical results |

---

## 12. Success Criteria

- [ ] Arbitrage alerts muncul < 5 detik setelah ingest
- [ ] Gemini insight relevan (bukan generic)
- [ ] False positive < 20% (manual verification)
- [ ] Dashboard alert center dengan filter & sorting
- [ ] Code siap di-wrap oleh Hermes (Phase 3)

---

*Phase 2 complete. Core logic: statistical + Gemini hybrid. Ready for Phase 3: extract to Hermes task, add multi-source support.*
