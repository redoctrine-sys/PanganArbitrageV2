# 🏗️ PanganArbitrage V2 — Blueprint Summary & Code Review

> **Project**: Commodity Price Dashboard & Arbitrage Analytics
> **Tanggal Review**: 2 Mei 2026 (updated post-debt-clear + route-maker-spec)
> **Stack**: Next.js 14 · TypeScript · Supabase · Tailwind 3 · Recharts · Gemini Flash
> **Deploy**: Vercel Hobby ($0) · AI: Gemini Flash ($0)

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Blueprint](#2-architecture-blueprint)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Database Schema](#4-database-schema)
5. [Source Code Structure](#5-source-code-structure)
6. [Feature Inventory](#6-feature-inventory)
7. [Build Phase Progress](#7-build-phase-progress)
8. [Code Review & Scoring](#8-code-review--scoring)
9. [Recommendations](#9-recommendations)

---

## 1. Project Overview

**PanganArbitrage V2** adalah dashboard analitik harga komoditas pangan di Indonesia, mencakup wilayah **Jawa, Madura, Bali, dan Lombok**. Sistem ini mengingest data dari sumber pemerintah (SP2KP), menganalisis perbedaan harga antar kota, dan mendeteksi peluang arbitrase — termasuk estimasi biaya transport, risiko logistik, rekomendasi AI, dan **perencanaan rute multi-leg** (Route Maker).

### Visi Produk

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1 (✅ ~90%)     │  PHASE 2 (✅ ~85%)    │  PHASE 3 (⚪)           │
│  SP2KP Data Pipeline   │  AI Arbitrage         │  Full Agentic           │
│  + Dashboard Core      │  Detection +          │  System: Hermes +       │
│  + Transport Vendors   │  Logistics Risk       │  4 Workers + NLQ        │
│                        │  + Route Maker (🟡)   │                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Target Users
- **Pedagang/Trader**: Identifikasi peluang arbitrase komoditas antar kota + perencanaan rute eksekusi
- **Analis Pangan**: Monitoring harga, deteksi anomali HET
- **Admin**: Data ingestion, naming review, transport vendor management, API quota monitoring

---

## 2. Architecture Blueprint

### Data Flow

```mermaid
graph LR
    subgraph Ingestion
        A[SP2KP CSV/XLSX] -->|Parser| B[/api/ingest/sp2kp]
        B -->|Bulk Insert| C[(Supabase: prices_raw)]
    end

    subgraph Dashboard
        C --> D[/api/sp2kp/latest]
        D --> E[SP2KP Dashboard]
    end

    subgraph Arbitrage
        C --> F[/api/agents/arbitrage]
        G[(transport_vendors)] --> F
        F -->|Layer 1| H[detectAnomalies + findArbitrage]
        H -->|Layer 2| I[Gemini Flash]
        I --> J[(arbitrage_alerts)]
        J --> K[Alert Center UI]
    end

    subgraph RouteMaker
        J -->|Plan Route| M[/api/route-maker/calculate]
        N[(transport_edges)] --> M
        O[(transfer_points)] --> M
        G --> M
        M --> P[Route Maker UI]
        P --> Q[(route_calculations)]
    end

    subgraph QuotaGuard
        I -.->|auto-log| R[(api_usage_log)]
        R --> S[Quota Alert Banner]
    end

    L[Admin] -->|CRUD| G
    L -->|Upload| A
    L -->|Monitor| S
```

### Rendering Strategy

| Layer | Strategy | Detail |
|-------|----------|--------|
| **Pages** | Client-side (`"use client"`) | SSR disabled; semua page client-rendered |
| **Data Fetching** | `useSWR` + `fetch` | Centralized caching, auto-revalidation, deduping |
| **State** | Local React state | Tidak ada global state management |
| **Layout** | App Router nested layout | Sidebar + Topbar persistent via `dashboard/layout.tsx` |

### API Layer

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/csv/preview` | POST | Parse CSV/XLSX tanpa insert |
| `/api/ingest/sp2kp` | POST | Parse + chunked bulk RPC insert |
| `/api/sp2kp/latest` | GET | RPC get_sp2kp_latest + lat/long |
| `/api/prices` | GET | Daily price series (chart) |
| `/api/cities` | GET/PATCH | Cities CRUD |
| `/api/transport-vendors` | CRUD | Vendor transport management |
| `/api/agents/arbitrage` | POST | Run arbitrage detection (L1+L2) |
| `/api/route-maker/calculate` | POST | Multi-modal route optimization (Dijkstra/A*) |
| `/api/quota/status` | GET | Real-time Gemini quota check |
| `/api/quota/daily` | GET | Daily API usage summary |
| `/api/health` | GET | DB diagnostic |

---

## 3. Tech Stack & Dependencies

### Production Dependencies

| Package | Version | Fungsi |
|---------|---------|--------|
| `next` | 14.2.18 | Framework (App Router) |
| `react` / `react-dom` | ^18.3.1 | UI library |
| `@supabase/supabase-js` | ^2.45.4 | Database client |
| `recharts` | ^2.13.3 | Charting (line + candlestick) |
| `xlsx` | ^0.18.5 | CSV/XLSX parser |
| `@google/generative-ai` | ^0.24.1 | Gemini Flash AI |
| `clsx` | ^2.1.1 | Conditional classnames |

### Dev Dependencies

| Package | Version | Fungsi |
|---------|---------|--------|
| `typescript` | ^5.6.3 | Type safety |
| `tailwindcss` | ^3.4.14 | Styling |
| `vitest` | ^4.1.5 | Testing framework |
| `eslint` + `eslint-config-next` | ^8.57.1 | Linting |
| `supabase` | ^2.95.5 | Local dev / migrations |

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| SP Color | `#1b5e3b` | SP2KP theme |
| Pedagang Color | `#4a3728` | Pedagang theme |
| Up/Profit | `#166534` | Positive numbers |
| Down/Loss | `#991b1b` | Negative numbers |
| Paper | `#f5f1ea` | Background |
| Ink | `#1a1612` | Primary text |
| Fonts | Fraunces (serif), DM Sans, DM Mono | Typography |

---

## 4. Database Schema

### Tables (9 total + 1 view → 14 tables + 2 views)

```mermaid
erDiagram
    cities ||--o{ prices_raw : "city_id"
    commodities ||--o{ prices_raw : "commodity_id"
    cities ||--o{ arbitrage_alerts : "city references"
    commodities ||--o{ arbitrage_alerts : "commodity_id"
    transport_vendors ||--o{ arbitrage_alerts : "vendor references"
    cities ||--o{ transport_edges : "from_node_id"
    cities ||--o{ transport_edges : "to_node_id"
    cities ||--o{ transfer_points : "city_id"
    cities ||--o{ route_calculations : "source_city_id"
    cities ||--o{ route_calculations : "dest_city_id"
    commodities ||--o{ route_calculations : "commodity_id"

    cities {
        uuid id PK
        text name
        text province
        text island
        text kode_wilayah UK
        numeric lat
        numeric lng
    }

    commodities {
        uuid id PK
        text name UK
        text unit
        text category
        boolean is_sp2kp
    }

    prices_raw {
        uuid id PK
        date date
        text city_raw
        text commodity_raw
        uuid city_id FK
        uuid commodity_id FK
        numeric price
        numeric het_ha
        text source
    }

    transport_vendors {
        uuid id PK
        text name
        text transport_type
        numeric price
        text pricing_type
        numeric capacity_kg
    }

    arbitrage_alerts {
        uuid id PK
        text type
        text severity
        text commodity_name
        numeric price_buy
        numeric price_sell
        text transport_detail
        boolean is_read
    }

    transport_edges {
        uuid id PK
        uuid from_node_id FK
        uuid to_node_id FK
        text transport_type
        text provider
        numeric distance_km
        numeric duration_hours
        numeric cost_per_kg
        numeric cost_fixed
        numeric capacity_kg
        text schedule_frequency
        numeric reliability_score
        boolean is_active
        jsonb metadata
    }

    transfer_points {
        uuid id PK
        text name
        uuid city_id FK
        text point_type
        numeric lat
        numeric lng
        text operating_hours
        numeric transfer_time_minutes
    }

    route_calculations {
        uuid id PK
        uuid source_city_id FK
        uuid dest_city_id FK
        uuid commodity_id FK
        numeric quantity_kg
        numeric total_cost_idr
        numeric total_duration_hours
        numeric total_weight_loss_kg
        numeric net_profit_idr
        numeric roi_pct
        jsonb route_json
        timestamptz calculated_at
        timestamptz expires_at
    }

    api_usage_log {
        uuid id PK
        text api_name
        text endpoint
        int tokens_input
        int tokens_output
        text status
        text error_message
        int duration_ms
        text user_agent
        timestamptz created_at
    }

    ai_insight_cache {
        text cache_key PK
        text insight
        timestamptz created_at
    }
```

### Migrations: 19 files (001–021, beberapa skip) → 22 files (022–024)

| Migration | Tujuan |
|-----------|--------|
| 001 | Core schema (cities, commodities, prices_raw) |
| 002 | Seed 17 komoditas SP2KP |
| 003–005 | RPC functions (get_sp2kp_latest, bulk_insert, auto_seed_cities) |
| 006 | RLS policies |
| 007 | Filter future dates |
| 009 | SP2KP include all cities |
| 010–011 | Seed Jakarta + lat/long |
| 012–013 | Transport vendors schema v1/v2 |
| 014 | Arbitrage alerts table |
| 016 | SP2KP return lat/long |
| 017–021 | Arbitrage enhancements (transport detail, risk, weight loss) |
| **022** | **API usage log + quota RPC + daily view** |
| **023** | **Route Maker schema (transport_edges, transfer_points, route_calculations)** |
| **024** | **AI insight cache** |

---

## 5. Source Code Structure

### Statistik

| Metric | Value |
|--------|-------|
| **Total source files** | 75 (+9 from AlertCard split + arbitrage tests) |
| **TypeScript files (.ts)** | 28 |
| **React components (.tsx)** | 46 |
| **CSS files** | 1 |
| **Test files** | 3 |
| **Total source size** | ~310 KB |

### Directory Tree

```
src/
├── app/
│   ├── globals.css                          (201 lines — design system)
│   ├── layout.tsx                           (root layout)
│   ├── page.tsx                             (redirect)
│   ├── api/
│   │   ├── agents/arbitrage/route.ts        (197 lines — AI pipeline)
│   │   ├── cities/route.ts + [id]/route.ts  (CRUD)
│   │   ├── csv/preview/route.ts             (CSV preview)
│   │   ├── health/route.ts                  (DB diagnostic)
│   │   ├── ingest/sp2kp/route.ts            (164 lines — bulk ingest)
│   │   ├── prices/route.ts                  (price series)
│   │   ├── quota/status/route.ts            (quota check)
│   │   ├── quota/daily/route.ts             (daily usage summary)
│   │   ├── route-maker/calculate/route.ts   (route optimization)
│   │   ├── sp2kp/latest/route.ts            (latest data)
│   │   └── transport-vendors/               (CRUD + [id])
│   └── dashboard/
│       ├── layout.tsx                       (shell: Sidebar + Topbar)
│       ├── sp2kp/page.tsx                   (SP2KP view)
│       ├── pedagang/                        (vendor transport pages)
│       ├── arbitrase/page.tsx               (arbitrage view)
│       ├── route-maker/page.tsx             (route planner — spec ready)
│       └── admin/cities/page.tsx            (admin)
├── components/
│   ├── admin/       (2 files: AdminCitiesPage, CityEditModal)
│   ├── arbitrase/   (16 files: ArbitrasePage, AlertCenter, AlertCard[79L], ArbitrageSummary,
│   │                           AnomalyDetail, ArbitrageCalcBreakdown, TransportOptionsAccordion,
│   │                           LogisticsRiskPanel, AIInsightsPanel, alert-card.types, ...)
│   ├── charts/      (2 files: PriceLineChart, CandlestickChart)
│   ├── csv/         (CSVUploader)
│   ├── layout/      (3 files: Sidebar, Topbar, ErrorBoundary)
│   ├── pedagang/    (4 files: VendorTransportPage, VendorModal, ...)
│   ├── pills/       (ChangePill, VolatilityPill, MiniSparkline)
│   └── sp2kp/       (7 files: SP2KPPage, CityRow, ChartPanel, ...)
├── lib/
│   ├── constants.ts                         (60 lines — thresholds, maps)
│   ├── analytics/
│   │   ├── arbitrage.ts                     (564 lines — ⭐ core engine)
│   │   ├── arbitrage.test.ts                (130 lines — ✅ NEW: 20 unit tests)
│   │   ├── metrics.ts                       (utility functions)
│   │   └── metrics.test.ts                  (unit tests)
│   ├── ai/
│   │   ├── agents/arbitrage/                (types, Gemini integration)
│   │   ├── gemini-wrapper.ts                (quota check + auto-log + cache)
│   │   └── gemini-cache.ts                  (smart caching per commodity+cities)
│   ├── route-maker/
│   │   ├── graph.ts                         (Dijkstra/A* multi-modal graph)
│   │   ├── asdp-seed.ts                     (ASDP ferry routes: Ketapang-Gilimanuk, Padangbai-Lembar)
│   │   └── types.ts                         (RouteLeg, RouteOption, EdgeWeight)
│   ├── csv/
│   │   ├── sp2kp-parser.ts                  (269 lines — CSV/XLSX parser)
│   │   └── sp2kp-parser.test.ts             (219 lines — parser tests)
│   ├── supabase/                            (client config)
│   └── utils/                               (formatting helpers)
└── types/
    └── sp2kp.ts                             (type definitions)
```

### Top 10 Largest Files

| # | File | Lines | Concern |
|---|------|-------|---------|
| 1 | `lib/analytics/arbitrage.ts` | 564 | ⚠️ Core engine, complex but well-structured |
| 2 | `components/pedagang/VendorTransportPage.tsx` | 291 | ⚠️ Exceeds 200-line rule |
| 3 | `lib/csv/sp2kp-parser.ts` | 269 | Parser logic, well-isolated |
| 4 | `components/sp2kp/CommodityGroupRow.tsx` | 246 | ⚠️ Exceeds 200-line rule |
| 5 | `components/sp2kp/SP2KPPage.tsx` | 237 | ⚠️ Exceeds 200-line rule |
| 6 | `components/sp2kp/ChartPanel.tsx` | 235 | ⚠️ Exceeds 200-line rule |
| 7 | `components/arbitrase/AlertCenter.tsx` | 235 | ⚠️ Exceeds 200-line rule |
| 8 | `lib/csv/sp2kp-parser.test.ts` | 219 | Tests OK |
| 9 | `components/charts/CandlestickChart.tsx` | 215 | ⚠️ Exceeds 200-line rule |
| 10 | `lib/analytics/arbitrage.test.ts` | 130 | ✅ NEW — 20 tests for core engine |

> ✅ **AlertCard.tsx split complete**: 530 lines → 79 lines (orchestrator) + 8 sub-components (37–91 lines each). Was #2 on this list.

---

## 6. Feature Inventory

### ✅ Implemented (Live)

| Feature | Status | Detail |
|---------|--------|--------|
| **SP2KP Data Ingestion** | ✅ Live | CSV/XLSX upload, bulk RPC insert, auto city seeding |
| **SP2KP Dashboard** | ✅ Live | Dual view (By City / By Commodity), search, island/province filter |
| **Price Charts** | ✅ Live | Line chart + OHLC Candlestick, lazy load on expand |
| **Anomaly Detection (HET)** | ✅ Live | Price > HET × 1.02 threshold, severity badges |
| **Vendor Transport CRUD** | ✅ Live | Full CRUD with modal, detail panel, pricing types |
| **AI Arbitrage Detection** | ✅ Live | 2-layer: Statistical (L1) + Gemini Flash (L2) |
| **Arbitrage Alert Center** | ✅ Live | Alert cards with expand, read/unread, severity filter |
| **Logistics Risk Analysis** | ✅ Live | ETA, weight loss %, volatility, ferry fare (ASDP), spread analysis |
| **Manual Arbitrage Calculator** | ✅ Live | Multi-leg route, vendor selection, ROI calculation |
| **Admin Cities** | ✅ Live | City management with edit modal |

### 🟡 In Progress / Spec Ready

| Feature | Status | Detail |
|---------|--------|--------|
| **Route Maker** | 🟡 Spec Ready | Multi-modal route optimization (Dijkstra/A*), ASDP ferry integration, cost/ETA/weight-loss per leg. Blueprint complete, ready for implementation. |
| **Gemini Quota Alert** | 🟡 Spec Ready | Real-time quota tracking, warning banner at 80%, block at 95%, graceful fallback to Layer 1. |

### ⚪ Planned (Not Implemented)

| Feature | Phase | Detail |
|---------|-------|--------|
| Pedagang Data Input | Phase 3 | Form + dropdown, direct to pedagang_harga |
| Naming Agent | Phase 2-3 | City + commodity review, fuzzy match, Gemini |
| Commodity Pairing | Phase 2-3 | Cross-source comparison |
| Komparasi Tab | Phase 3 | Section A + B |
| Multi-source Scraping | Phase 3 | Marketplace, API, external |
| Price Prediction (Oracle) | Phase 3 | Statistical + weather + sentiment |
| NLQ Chat (PanganBot) | Phase 3 | Natural language query |
| Hermes Orchestrator | Phase 3 | Claude Sonnet multi-agent |

---

## 7. Build Phase Progress

```
Phase 1: SP2KP Foundation        ████████████████████░  ~90%
Phase 2: AI Arbitrage             █████████████████░░░░  ~85%
Phase 2.5: Route Maker + Quota    ███████░░░░░░░░░░░░░  ~35%  (spec ready)
Phase 3: Full Agentic System      ░░░░░░░░░░░░░░░░░░░░   0%
```

### Phase 1 Debt
- ✅ `useSWR` adopted — centralized caching, auto-revalidation, deduping
- 🟡 Several components exceed 200-line limit — AlertCard ✅ split (530→79L, 2026-05-02); remaining: VendorTransportPage(291), CommodityGroupRow(246), SP2KPPage(237), ChartPanel(235), AlertCenter(235), CandlestickChart(215)
- ✅ Error boundaries — dipasang di dashboard layout

### Phase 2 Status
- ✅ Arbitrage engine (Layer 1) — deterministic, pure functions
- ✅ Gemini Flash integration (Layer 2) — AI insight
- ✅ Transport cost calculation with multi-vendor comparison
- ✅ ASDP ferry fare integration (Ketapang-Gilimanuk, Padangbai-Lembar)
- ✅ Logistics risk metrics (ETA, weight loss, volatility, spread analysis)
- ✅ Alert Center UI with filtering and read/unread
- ✅ **arbitrage.test.ts** — 20 unit tests (detectAnomalies ×8, findArbitrage ×5, calcWeightLossPct ×5, helpers ×2) — all pass (2026-05-02)
- ✅ **AlertCard split** — 530L → 79L orchestrator + 8 focused sub-components; `Alert` → discriminated union `AnomalyAlertUI | ArbitrageAlertUI` (2026-05-02)

### Phase 2.5: Route Maker + Quota Alert (Spec Ready)
- 🟡 **Route Maker blueprint** — Multi-modal graph (Dijkstra/A*), 3 new tables (transport_edges, transfer_points, route_calculations), ASDP ferry data seeded, API spec defined
- 🟡 **Gemini Quota Alert blueprint** — api_usage_log table, wrapper with auto-log, warning banner at 80%, block at 95%, smart caching per (commodity+cities)
- ⚪ Implementation pending — estimated 1 week (Route Maker Phase 1-2) + 1 day (Quota Alert)

---

## 8. Code Review & Scoring

### 📊 Overall Score: **7.5 / 10** — Solid Foundation, Major Debt Cleared

```
Architecture         ████████░░  8.0/10  (unchanged)
Code Quality         ███████░░░  7.5/10  ↑ AlertCard split, IIFE removed
Type Safety          ████████░░  8.0/10  ↑ Alert → discriminated union
Testing              ██████░░░░  6.0/10  ↑ arbitrage.test.ts +20 tests
Security             ██████░░░░  6.0/10  (unchanged)
Performance          ███████░░░  7.0/10  (unchanged)
UX/Design            █████████░  9.0/10  (unchanged)
Documentation        ████████░░  8.0/10  ↑ Route Maker + Quota spec added
Maintainability      ███████░░░  7.5/10  ↑ AlertCard SRP fixed
Deployment Ready     ████████░░  8.0/10  (unchanged)
```

---

### 8.1 Architecture (8.0/10) ✅

**Strengths:**
- **Clean separation of concerns**: `lib/analytics/` pure functions, `lib/csv/` parser, `components/` UI, `app/api/` routes
- **Extensible data model**: `prices_raw.source` field ready for multi-source
- **2-layer arbitrage design**: Deterministic L1 (testable) → AI L2 (reasoning) is excellent
- **Migration-based schema evolution**: 19 ordered migrations, well-versioned
- **Route Maker architecture**: Multi-modal graph design (Dijkstra/A*) elegantly extends existing transport vendor system

**Weaknesses:**
- All pages are `"use client"` — misses Next.js SSR/RSC benefits entirely
- No middleware layer (auth, rate limiting, logging)
- No shared state management; each component fetches independently → potential duplicate requests

> [!TIP]
> Pertimbangkan menggunakan React Server Components untuk data fetching di SP2KP page — ini bisa mengurangi client JS bundle dan memberikan SEO benefit.

---

### 8.2 Code Quality (7.5/10) ↑

**Strengths:**
- Consistent coding style (Tailwind-only, no inline styles except dynamic)
- Well-structured arbitrage engine with clear function separation
- Good use of TypeScript interfaces for domain models
- Domain comments in Bahasa Indonesia — appropriate for the team
- ✅ AlertCard.tsx split into 8 focused sub-components (2026-05-02)
- ✅ IIFE in JSX removed — replaced with `WeightLossDetail` sub-component

**Weaknesses:**

| Issue | Severity | Files Affected |
|-------|----------|----------------|
| **6 components exceed 200-line rule** | 🟡 | VendorTransportPage(291), CommodityGroupRow(246), etc. |
| ~~Raw `fetch` instead of useSWR~~ | ✅ | ~~All data-fetching components~~ |
| **No centralized error handling** | 🟡 | Each component has try/catch independently |
| **Magic numbers** scattered | 🟡 | `0.30`, `0.10`, `0.05` in multiple files |

**✅ Fixed — AlertCard.tsx (530 → 79 lines, 2026-05-02):**

```
Split into 8 files, each ≤ 91 lines:
  AlertCard.tsx            (79L)  — thin orchestrator
  alert-card.types.ts      (73L)  — Alert discriminated union + badges
  alert-card.utils.tsx     (40L)  — Row, CalcRow, fmtEta, parseTransportOptions
  ArbitrageSummary.tsx     (91L)  — arbitrage always-visible body
  AnomalyDetail.tsx        (37L)  — anomaly summary + calc breakdown
  ArbitrageCalcBreakdown.tsx (57L) — calc breakdown + transport accordion
  TransportOptionsAccordion.tsx (80L) — transport <details> accordion
  LogisticsRiskPanel.tsx   (85L)  — ETA/volatility/weight-loss/spread risk
  AIInsightsPanel.tsx      (46L)  — AI insights + recommendations + risks
```

---

### 8.3 Type Safety (8.0/10) ↑

**Strengths:**
- Proper TypeScript throughout — no `any` observed
- Well-defined interfaces for `PricePoint`, `ArbitrageOpportunity`, `AnomalyAlert`
- `as const` assertion for `COMMODITY_CATEGORIES`
- ✅ `Alert` → discriminated union `AnomalyAlertUI | ArbitrageAlertUI` (2026-05-02) — optional field mess replaced with proper union; sub-components receive narrowed types

**Weaknesses:**
- API responses not validated (no runtime type checking with Zod)
- Some casts like `(j.data ?? []) as Vendor[]` — trusts server shape

---

### 8.4 Testing (6.0/10) ↑

**Current State:**
- ✅ `sp2kp-parser.test.ts` — 219 lines, good coverage of parser edge cases
- ✅ `metrics.test.ts` — 128 lines, tests for analytics metrics
- ✅ **`arbitrage.test.ts`** — 130 lines, **20 tests** covering `detectAnomalies` (8), `findArbitrage` (5), `calcWeightLossPct` (5) — all pass (2026-05-02)
- ❌ No API route tests
- ❌ No component tests
- ❌ No integration / E2E tests
- ❌ No CI pipeline for tests

**Remaining Priority:**
```
Priority 1: API route tests (ingest, agents/arbitrage, route-maker/calculate)
Priority 2: Component snapshot tests (SP2KPPage, AlertCenter)
Priority 3: E2E with Playwright (upload → view → arbitrage → route-maker flow)
```

---

### 8.5 Security (6.0/10) ⚠️

| Area | Status | Notes |
|------|--------|-------|
| **Authentication** | ❌ None | No auth on any route — anyone can POST/DELETE |
| **RLS (Row Level Security)** | ✅ Configured | Migration 006, but anon key in client |
| **Input Validation** | 🟡 Partial | Parser validates CSV format, but API inputs not validated |
| **Rate Limiting** | ❌ None | `/api/agents/arbitrage` calls Gemini — no rate protection |
| **CORS** | ✅ Default | Next.js default CORS (same-origin) |
| **Env Variables** | 🟡 | `.env.local` exists, but `.env.example` incomplete |
| **SQL Injection** | ✅ Safe | Supabase client parameterizes queries |

> [!CAUTION]
> Tidak ada authentication. Semua API endpoint (termasuk ingest dan delete) bisa diakses oleh siapapun. Untuk production, ini **HARUS** diperbaiki.

---

### 8.6 Performance (7.0/10)

**Strengths:**
- Chunked bulk insert (ingest route) — handles large CSV files
- Lazy chart loading (only when accordion expanded)
- `useMemo` for expensive computations (city grouping, sorting)
- `PRICE_LIMIT_PER_QUERY = 5000` — prevents unbounded queries

**Weaknesses:**
- ~~No data caching~~ ✅ SWR caching implemented
- `window.location.reload()` after ingest — brute force refresh
- SP2KP page loads ALL data client-side then filters — could be slow with many cities
- No pagination on any list view
- Arbitrage engine does O(n²) pairwise comparison — acceptable for ~138 cities but won't scale
- **Gemini calls not cached** — same (commodity, cities) pair triggers duplicate AI calls

---

### 8.7 UX/Design (9.0/10) ⭐

**Strengths:**
- **Excellent visual design** — warm paper texture, serif/mono typography, premium feel
- **Thoughtful color coding** — green (profit), red (loss), amber (warning)
- **Rich data presentation** — accordion drilldown, sparklines, candlestick charts
- **Interactive arbitrage cards** — expandable with transport breakdown, AI insights
- **Smart information hierarchy** — summary → detail → risk analysis → AI

**Minor Issues:**
- Mobile responsiveness not tested (fixed sidebar width 186px)
- Some text sizes very small (8-9px) — accessibility concern
- No dark mode (despite design system supporting it)

---

### 8.8 Documentation (8.0/10) ✅

**Strengths:**
- `CLAUDE.md` — comprehensive project brain (342 lines) covering all 3 phases
- `pangan-summary-v6.md` — detailed architecture spec (633 lines)
- Code comments in Bahasa Indonesia — consistent with team
- `WORKBENCH.md` workflow for progress tracking
- ✅ **Route Maker blueprint** — full spec: algorithm (Dijkstra/A*), data model, API design, UI mockup, ASDP ferry data, implementation phases
- ✅ **Gemini Quota Alert blueprint** — wrapper pattern, quota thresholds, fallback strategy, smart caching

**Weaknesses:**
- No inline JSDoc on exported functions
- No README user guide (existing README is template)
- No API documentation (Swagger/OpenAPI)

---

### 8.9 Maintainability (7.5/10) ↑

| Factor | Assessment |
|--------|------------|
| **Single responsibility** | ✅ AlertCard fixed (79L orchestrator + 8 sub-components); remaining: VendorTransportPage(291), CommodityGroupRow(246) |
| **DRY principle** | ✅ Shared `fmtRp`, `constants.ts`, `metrics.ts`, new `alert-card.utils.tsx` |
| **File size discipline** | 🟡 6 files still exceed 200-line rule (down from 8) |
| **Coupling** | ✅ Components mostly independent |
| **Naming** | ✅ Clear, domain-specific (SP2KP, Arbitrase, etc.) |
| **Git hygiene** | ✅ `.gitignore` configured, no secrets committed |

---

## 9. Recommendations

### 🔴 Critical (Do First)

1. **Add authentication** — At minimum, basic API key auth for write endpoints
2. ~~**Write arbitrage engine tests**~~ — ✅ Done: `arbitrage.test.ts`, 20 tests (2026-05-02)
3. ~~**Split AlertCard.tsx**~~ — ✅ Done: 530L → 79L + 8 sub-components, discriminated union (2026-05-02)
4. **Implement Gemini Quota Alert** — Track API usage, warning banner at 80%, block at 95%, fallback to Layer 1. Prevents surprise quota exhaustion and minimizes unnecessary calls. **Effort: 1 day**

### 🟡 Important (Sprint Next)

5. ~~Adopt `useSWR` or React Query~~ ✅ Done — SWR implemented with caching and deduping
6. **Add API input validation** — Use Zod schemas on all POST/PATCH routes
7. **Rate limit AI endpoints** — Prevent Gemini quota exhaustion (complement to quota alert)
8. **Split remaining oversized components** — 6 files still exceed 200-line rule: VendorTransportPage(291), CommodityGroupRow(246), SP2KPPage(237), ChartPanel(235), AlertCenter(235), CandlestickChart(215)
9. **Implement Route Maker Phase 1** — Multi-modal graph schema + Dijkstra engine + ASDP seed data. Transforms app from "detection" to "detection + execution planning". **Effort: 1 week**

### 🟢 Nice-to-Have (Backlog)

10. **React Server Components** — Migrate SP2KP page to RSC for faster initial load
11. **Pagination** — For SP2KP city list and alert center
12. **Dark mode** — Design tokens already support it
13. **Mobile responsive** — Fixed sidebar breaks on small screens
14. **E2E tests with Playwright** — Critical user flows (upload, view data, check arbitrage, plan route)
15. **API documentation** — Auto-generate from route handlers
16. **Smart AI caching** — Cache Gemini insight per (commodity + sourceCity + destCity) for 1 hour. Reduces API calls by 60-80% for repeat views.

---

### Score Summary

| Dimension | Score | Trend |
|-----------|-------|-------|
| Architecture | 8.0 | Solid, Route Maker spec extends elegantly |
| Code Quality | 7.5 ↑ | AlertCard split done, 6 files remain |
| Type Safety | 8.0 ↑ | Alert discriminated union done |
| Testing | 6.0 ↑ | arbitrage.test.ts +20 tests |
| Security | 6.0 | ⚠️ No auth |
| Performance | 7.0 | OK for current scale, needs caching |
| UX/Design | 9.0 | ⭐ Best dimension |
| Documentation | 8.0 ↑ | Route Maker + Quota spec added |
| Maintainability | 7.5 ↑ | AlertCard SRP fixed |
| Deployment Ready | 8.0 | Vercel-ready, CI missing |
| **OVERALL** | **7.5** ↑ | **Debt cleared, auth gap remains, Route Maker spec ready** |

> [!IMPORTANT]
> **Bottom Line** (updated 2026-05-02): PanganArbitrage V2 adalah project yang **well-architected** dengan **excellent UX design** dan **domain modeling yang kuat**. AlertCard split dan arbitrage test coverage selesai — dua dari tiga critical debt cleared. Kelemahan utama yang tersisa: **security** (no auth). SWR telah diadopsi. Route Maker dan Gemini Quota Alert blueprint telah ditambahkan ke dokumen — keduanya siap untuk implementasi. Fix auth + implement Quota Alert + Route Maker Phase 1, dan project ini siap production scale.
