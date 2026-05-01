# Phase 1: Data Foundation

> **Status**: LIVE  
> **Goal**: Clean data pipeline + dashboard, ready for Phase 2 AI injection  
> **Token Budget**: <200 lines for agent context

---

## 1. Core Data Flow

```
CSV/XLSX Upload
    → sp2kp-parser.ts (normalize, ×1000, filter future dates)
    → /api/ingest/sp2kp (bulk RPC upsert)
    → prices_raw + auto_seed_cities()
    → RPC get_sp2kp_latest (ranked CTE)
    → Dashboard (client-side group/filter)
```

---

## 2. Database

### Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cities` | Wilayah | `kode_wilayah`(PK), name, province, island, lat, lng |
| `commodities` | 17 items | id, name, unit, category(pokok/bumbu/protein), is_sp2kp |
| `prices_raw` | Harga harian | date, city_raw, commodity_raw, price, het_ha, source, kode_wilayah, commodity_id |
| `transport_vendors` | Biaya transport | id, name, route, cost_per_kg, mode |

### Constraints
- `prices_raw` UNIQUE(date, city_raw, commodity_raw, source)
- RLS: SELECT only source='sp2kp' with NOT NULL kode_wilayah & commodity_id
- Future dates blocked (parser + RPC)

### RPCs
| Function | Purpose |
|----------|---------|
| `get_sp2kp_latest(p_island, p_province)` | Latest + prev price, 30d stats. SECURITY DEFINER. |
| `bulk_insert_sp2kp_prices(p_rows jsonb)` | Upsert: INSERT new, UPDATE changed, SKIP unchanged. |
| `auto_seed_cities()` | Derive cities from prices_raw, backfill references. |

---

## 3. Parser (sp2kp-parser.ts)

**Input**: CSV/XLSX Tabulasi_SP2KP  
**Output**: `ParsedRow[]` → bulk insert

**Handles**:
- Binary vs text (magic bytes)
- UTF-8, UTF-16 LE, BOM
- Excel serial dates + DD/MM/YYYY strings
- Future date filtering (`todayIso`)
- Monotonicity check for date format warnings

**Key Transform**: `price × 1000` (SP2KP stores in thousands)

---

## 4. Dashboard Components

### Layout
```
DashboardLayout
├── Topbar (upload button + user)
├── Sidebar (navigation)
└── Content
    ├── SP2KPPage (orchestrator)
    │   ├── Filters (island, province, search)
    │   ├── ViewToggle (By City / By Commodity)
    │   └── DataList
    │       ├── CityRow (accordion L1)
    │       │   └── CommodityRow (L2)
    │       └── CommodityGroupRow (accordion L1)
    │           └── CitySubRow (L2)
    └── ChartPanel (on expand)
        ├── PriceLineChart (30d)
        └── CandlestickChart (W/M OHLC)
```

### Shared Components (Deduplicated)
| Component | Used By | Note |
|-----------|---------|------|
| `DetailRow` | CommodityRow, CitySubRow | Extract base component (~80% identical) |
| `ChangePill` | All rows | ▲/▼ badge |
| `VolatilityPill` | All rows | Level badge |
| `MiniSparkline` | All rows | 4-point SVG |

---

## 5. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/csv/preview` | POST | Parse file, return stats (no insert) |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/prices` | GET | Daily price series for chart |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest, parallel per-province |
| `/api/health` | GET | DB diagnostic |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | GET/POST | Transport vendor data |

---

## 6. Phase 1 → Phase 2 Migration Points

### Ready Hooks (Don't Break)
| Location | Purpose | Phase 2 Usage |
|----------|---------|---------------|
| `/api/ingest/sp2kp` | After insert success | Trigger `POST /api/agents/arbitrage` |
| `prices_raw.source` | Column exists | Already filtered for SP2KP; Phase 3 adds 'pedagang', 'marketplace' |
| `cities.kode_wilayah` | PK exists | Used by all sources for canonicalization |
| `commodities.id` | FK exists | Referenced by all price tables |

### Files to Refactor (Phase 2 Prep)
| File | Issue | Action |
|------|-------|--------|
| `ArbitrasePage.tsx` | 900 lines, god component | Split to 5 sub-components |
| `VendorTransportPage.tsx` | 900 lines, god component | Split to 4 sub-components |
| 6 files with HET logic | Hardcoded `> het_ha * 1.02` | Extract to `lib/constants.ts` |
| `CommodityRow.tsx` + `CitySubRow.tsx` | ~80% identical | Extract `DetailRow` base |
| `CandlestickChart.tsx` | `type RcPayload = any` | Type properly |

### New Files (Phase 2 Add)
```
lib/
├── constants.ts              # HET_THRESHOLD, PROVINCE_MAP, COMMODITY_CATEGORIES
├── analytics/
│   └── arbitrage.ts          # detectAnomalies(), findArbitrage() — pure, testable
└── ai/
    └── agents/
        └── arbitrage/
            ├── gemini-agent.ts   # Gemini Flash integration
            └── types.ts

app/
└── api/
    └── agents/
        └── arbitrage/
            └── route.ts        # POST endpoint

supabase/
└── migrations/
    └── 015_arbitrage_alerts.sql
```

---

## 7. Styling Standard (Enforced)

- **Tailwind utilities ONLY**
- NO inline `style={{}}`
- NO custom CSS (`.l1-row`, `.pill` → migrate)
- Exception: CSS variables, complex animations

---

## 8. Testing Requirement

| Function | Location | Test File |
|----------|----------|-----------|
| `parseSP2KP()` | `lib/csv/sp2kp-parser.ts` | `tests/parser.test.ts` |
| `detectAnomalies()` | `lib/analytics/arbitrage.ts` | `tests/analytics.test.ts` |
| `findArbitrage()` | `lib/analytics/arbitrage.ts` | `tests/analytics.test.ts` |
| `formatDate()` | `lib/utils/date.ts` | `tests/date.test.ts` |

---

## 9. Constants (Single Source of Truth)

```typescript
// lib/constants.ts — create this file
export const HET_ANOMALY_THRESHOLD = 1.02;
export const MIN_PROFIT_THRESHOLD = 50000;
export const MIN_SPREAD_PERCENT = 0.10;

export const PROVINCE_MAP: Record<string, string> = {
  '31': 'DKI Jakarta', '32': 'Jawa Barat', '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta', '35': 'Jawa Timur', '36': 'Banten',
  '51': 'Bali', '52': 'Nusa Tenggara Barat'
};

export const ISLAND_MAP: Record<string, string> = {
  '31': 'Jawa', '32': 'Jawa', '33': 'Jawa', '34': 'Jawa',
  '35': 'Jawa', '36': 'Jawa', '51': 'Bali', '52': 'Lombok'
};

export const COMMODITY_CATEGORIES = {
  POKOK: ['beras', 'gula_pasir', 'minyak_goreng', 'tepung_terigu'],
  BUMBU: ['cabai_merah', 'cabai_rawit', 'bawang_merah', 'bawang_putih'],
  PROTEIN: ['daging_sapi', 'daging_ayam', 'telur_ayam', 'ikan'],
  SAYUR: ['kangkung', 'bayam', 'wortel', 'kentang', 'tomat']
};
```

---

## 10. File Size Checklist

| File | Current Lines | Target | Status |
|------|---------------|--------|--------|
| `ArbitrasePage.tsx` | ~900 | <200 | 🔴 Split |
| `VendorTransportPage.tsx` | ~900 | <200 | 🔴 Split |
| `SP2KPPage.tsx` | ~400 | <200 | 🟡 Review |
| `sp2kp-parser.ts` | 309 | <200 | 🟢 OK |
| `metrics.ts` | ~150 | <200 | 🟢 OK |

---

*Phase 1 complete. Ready for Phase 2 injection: add `lib/constants.ts`, split god components, then plug in arbitrage agent.*
