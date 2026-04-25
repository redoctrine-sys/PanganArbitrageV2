# PanganArbitrage — Master Summary v6
**Status:** Ready for Claude Code execution  
**Tanggal:** 22 April 2026  
**Stack:** Next.js 15 App Router · TypeScript · Supabase · shadcn/ui · Recharts · Gemini 1.5 Flash · OSRM

---

## 1. PERUBAHAN dari v5

| Item | v5 | v6 |
|------|----|----|
| HET/HA | Primary display di UI | Detail info di raw data + chart saja |
| Komoditas cross-source | Harus sama persis | Fuzzy match via admin approval |
| Komoditas tanpa pasangan | Hilang dari komparasi | Section B "Komoditas Eksklusif" |
| Commodity review | Hanya typo/variasi | Juga cross-source pairing |
| Nama komoditas | Harus exact match | Bisa berbeda, agent suggest pairing |

---

## 2. FUNDAMENTAL DATA FLOW

```
Source 1 (SP2KP CSV)   ──┐
Source 3 (Pedagang)    ──┤──→ prices_raw (staging) ──→ Admin Hidden ──→ komparasi VIEW ──→ Arbitrase
Source N (future)      ──┘                              Naming Agent        (clean)           Tab
                                                        + Approval

Source 5 (Transport)   ─────────────────────────────────────────────────────────────────→ Arbitrase
                        manual input, no review needed                                      Tab only
```

### Kenapa arsitektur ini
1. **Extensible** — tambah source baru cukup tambah ingest endpoint, flow tidak berubah
2. **Naming robustness** — semua nama kota/komoditas dari source berbeda divalidasi sebelum masuk analisis
3. **Commodity pairing** — komoditas tidak harus identik antar source, bisa dipasangkan lewat admin
4. **Transport independent** — input manual terkontrol, tidak ada risiko mismatch nama
5. **Arbitrase dari clean data** — kalkulasi reliable karena input sudah tervalidasi

---

## 3. COMMODITY PAIRING — TIGA TIPE

### Tipe 1: Typo / Variasi nama (komoditas sama)
```
"Cabe Merah Kriting"  →  Cabai Merah Keriting   (confidence 0.92)
"Bwang Merah"         →  Bawang Merah            (confidence 0.95)
```
Action setelah approve: `UPDATE prices_raw SET commodity_id = [canonical_id]`

### Tipe 2: Cross-source pairing (komoditas berbeda tapi comparable)
```
"Cabai Hijau Besar" (Pedagang)  ↔  "Cabai Merah Besar" (SP2KP)
similarity 0.62 — agent suggest, admin decide: pair atau Section B
```
Action setelah approve: INSERT ke `commodity_pairs` table

### Tipe 3: Komoditas baru (tidak ada padanan di source lain)
```
"Jahe Merah" (Pedagang) — tidak ada di 17 komoditas SP2KP
similarity < 0.30 — masuk Section B (eksklusif) sampai ada source lain
```
Action: confirm sebagai komoditas baru → masuk Section B

---

## 4. HET/HA — REPOSITIONING

**Sebelum (v5):** muncul di komparasi VIEW, ada HetBadge di list row  
**Sesudah (v6):** detail info saja

- Disimpan di `prices_raw.het_ha` (nullable)
- TIDAK dihitung di komparasi VIEW
- Muncul hanya di chart detail SP2KP sebagai dashed reference line
- Di stats panel: satu baris "HET Pemerintah: Rp xxx" (jika ada)
- Jika kosong: chart tidak tampilkan reference line, tidak error

---

## 5. KOMPARASI TAB — DUA SECTION

### Section A: Komoditas Terpasangkan
Komoditas yang ada di ≥2 source (direct match atau approved pair).  
Accordion: kota → komoditas → chart multi-source.  
Jika harga pedagang dari pair (bukan direct): badge "via pair: [nama asli]".

### Section B: Komoditas Eksklusif (NEW, collapsible, default collapsed)
```
▸ Hanya di Pedagang (3 komoditas)
  [Cabai Hijau Besar] 4 pedagang · Yogyakarta, Semarang · [→ Ajukan Pairing]
  [Jahe Merah]        2 pedagang · Bandung              · [Lihat Detail]
  [Singkong]          1 pedagang · Surabaya              · [Lihat Detail]

▸ Hanya di SP2KP (2 komoditas)
  [Garam Halus]    138 kota · Tidak ada data pedagang · [Lihat Data SP2KP]
  [Tepung Terigu]  138 kota · Tidak ada data pedagang · [Lihat Data SP2KP]
```

Komoditas Section B TIDAK masuk ke Arbitrase (tidak ada spread).

---

## 6. DATABASE SCHEMA

### prices_raw (INSERT ONLY)
```sql
CREATE TABLE prices_raw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  city_raw      text NOT NULL,
  commodity_raw text NOT NULL,
  city_id       uuid REFERENCES cities(id),         -- NULL sampai approved
  commodity_id  uuid REFERENCES commodities(id),    -- NULL sampai approved
  price         numeric(12,2) NOT NULL,
  het_ha        numeric(12,2),                      -- detail info, tidak masuk VIEW
  source        text NOT NULL,                      -- 'sp2kp'|'pedagang'|future
  kode_wilayah  text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw, source)
);

CREATE INDEX idx_pr_pending_city ON prices_raw(city_id) WHERE city_id IS NULL;
CREATE INDEX idx_pr_pending_comm ON prices_raw(commodity_id) WHERE commodity_id IS NULL;
CREATE INDEX idx_pr_approved     ON prices_raw(city_id, commodity_id, date DESC)
  WHERE city_id IS NOT NULL AND commodity_id IS NOT NULL;
```

### naming_queue (city + commodity — semua tipe review)
```sql
CREATE TABLE naming_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL CHECK (type IN ('city','commodity')),
  review_subtype   text CHECK (review_subtype IN ('typo','new','pair')),
  raw_value        text NOT NULL,
  suggestion       text,
  canonical_id     uuid,
  pair_target_id   uuid,          -- untuk subtype='pair': target commodity_id
  similarity_score numeric(4,3),
  method           text CHECK (method IN ('exact','fuzzy','gemini','manual')),
  source           text,
  source_count     int DEFAULT 1,
  status           text DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','skipped')),
  reviewed_at      timestamptz,
  reviewer_note    text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(type, raw_value)
);
```

### commodity_pairs (NEW — cross-source pairing)
```sql
CREATE TABLE commodity_pairs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_a_id   uuid NOT NULL REFERENCES commodities(id),
  commodity_b_id   uuid NOT NULL REFERENCES commodities(id),
  similarity_score numeric(4,3),
  pair_type        text CHECK (pair_type IN ('exact','variant','comparable')),
  approved_at      timestamptz,   -- NULL = belum approved / rejected
  notes            text,
  created_at       timestamptz DEFAULT now(),
  CHECK (commodity_a_id != commodity_b_id),
  UNIQUE(commodity_a_id, commodity_b_id)
);
```

### commodities
```sql
CREATE TABLE commodities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  unit          text DEFAULT 'kg',
  category      text,
  source_origin text DEFAULT 'sp2kp',
  is_sp2kp      boolean DEFAULT false,   -- true untuk 17 komoditas SP2KP
  created_at    timestamptz DEFAULT now()
);
```

### cities
```sql
CREATE TABLE cities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  name_sp2kp   text,
  province     text,
  island       text CHECK (island IN ('Jawa','Madura','Bali','Lombok')),
  entity_type  text CHECK (entity_type IN ('kota','kabupaten')),
  kode_wilayah text UNIQUE,
  lat          numeric(9,6),
  lng          numeric(9,6)
);
```

### pedagang & pedagang_harga
```sql
CREATE TABLE pedagang (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama          text NOT NULL,
  no_hp         text,
  city_id       uuid NOT NULL REFERENCES cities(id),  -- langsung canonical, dari dropdown
  lokasi_detail text,
  keterangan    text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE pedagang_harga (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedagang_id  uuid NOT NULL REFERENCES pedagang(id),
  commodity_id uuid NOT NULL REFERENCES commodities(id),
  price        numeric(12,2) NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  satuan       text DEFAULT 'kg',
  created_at   timestamptz DEFAULT now()
);
-- Pedagang masuk ke pedagang_harga, BUKAN prices_raw
-- Karena form admin yang pilih kota & komoditas dari dropdown = no naming risk
```

### transport_vendors & city_distances
```sql
CREATE TABLE transport_vendors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama         text NOT NULL,
  kontak       text,
  moda         text CHECK (moda IN ('truk','pickup','ekspedisi','kapal','motor','lainnya')),
  price_type   text CHECK (price_type IN ('per_km','flat')),
  price_per_km numeric(10,2),
  price_flat   numeric(12,2),
  kapasitas_kg numeric(10,2),
  cakupan      text[],
  catatan      text,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE city_distances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_from_id   uuid NOT NULL REFERENCES cities(id),
  city_to_id     uuid NOT NULL REFERENCES cities(id),
  distance_km    numeric(10,2) NOT NULL,
  duration_hours numeric(8,2),
  route_type     text CHECK (route_type IN ('darat','darat+ferry','ferry')),
  source         text DEFAULT 'osrm',
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(city_from_id, city_to_id)
);
```

### arbitrage_opportunities
```sql
CREATE TABLE arbitrage_opportunities (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 date NOT NULL,
  commodity_id         uuid NOT NULL REFERENCES commodities(id),
  city_buy_id          uuid NOT NULL REFERENCES cities(id),
  city_sell_id         uuid NOT NULL REFERENCES cities(id),
  price_buy            numeric(12,2) NOT NULL,
  price_sell           numeric(12,2) NOT NULL,
  price_buy_source     text,
  price_sell_source    text,
  gross_spread_pct     numeric(8,2) NOT NULL,
  route_type           text,
  distance_km          numeric(10,2),
  -- Phase B
  transport_vendor_id  uuid REFERENCES transport_vendors(id),
  transport_cost_total numeric(12,2),
  net_profit_per_kg    numeric(12,2),
  roi_pct              numeric(8,2),
  viable               boolean,
  risk_score           text CHECK (risk_score IN ('RENDAH','SEDANG','TINGGI')),
  -- Phase C
  ai_recommendation    text CHECK (ai_recommendation IN ('BELI','TUNGGU','HINDARI')),
  ai_reasoning         text,
  ai_timing            text,
  ai_risk_flag         text,
  ai_generated_at      timestamptz,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(date, commodity_id, city_buy_id, city_sell_id)
);
```

### VIEW: komparasi_harga (Section A — paired only, no HET)
```sql
CREATE VIEW komparasi_harga AS
WITH
  sp2kp_latest AS (
    SELECT DISTINCT ON (city_id, commodity_id)
      city_id, commodity_id, price, date
    FROM prices_raw
    WHERE source = 'sp2kp'
      AND city_id IS NOT NULL AND commodity_id IS NOT NULL
    ORDER BY city_id, commodity_id, date DESC
  ),
  pedagang_agg AS (
    SELECT p.city_id, ph.commodity_id,
      ROUND(AVG(ph.price), 2) AS price,
      MAX(ph.date) AS date,
      COUNT(*) AS sample_count
    FROM pedagang_harga ph
    JOIN pedagang p ON ph.pedagang_id = p.id
    WHERE ph.date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY p.city_id, ph.commodity_id
  ),
  active_pairs AS (
    SELECT commodity_a_id, commodity_b_id, pair_type
    FROM commodity_pairs WHERE approved_at IS NOT NULL
  ),
  monthly_vol AS (
    SELECT city_id, commodity_id,
      ROUND((MAX(price)-MIN(price))/NULLIF(AVG(price),0)*100,2) AS volatility_pct
    FROM prices_raw
    WHERE source='sp2kp' AND city_id IS NOT NULL
      AND date >= date_trunc('month', CURRENT_DATE)
    GROUP BY city_id, commodity_id
  )
SELECT
  c.id AS city_id, c.name AS city_name, c.province, c.island, c.entity_type,
  cm.id AS commodity_id, cm.name AS commodity_name, cm.category, cm.is_sp2kp,
  sp.price AS sp2kp_price, sp.date AS sp2kp_date,
  COALESCE(ped_d.price, ped_p.price)       AS pedagang_price,
  COALESCE(ped_d.date,  ped_p.date)        AS pedagang_date,
  COALESCE(ped_d.sample_count, ped_p.sample_count) AS pedagang_count,
  (ped_d.price IS NULL AND ped_p.price IS NOT NULL) AS pedagang_via_pair,
  -- Mismatch
  CASE WHEN sp.price IS NOT NULL AND COALESCE(ped_d.price,ped_p.price) IS NOT NULL
    THEN ROUND(ABS(sp.price - COALESCE(ped_d.price,ped_p.price))/sp.price*100, 2)
  END AS mismatch_pct,
  CASE WHEN sp.price IS NOT NULL AND COALESCE(ped_d.price,ped_p.price) IS NOT NULL
    THEN ABS(sp.price - COALESCE(ped_d.price,ped_p.price))/sp.price > 0.05
    ELSE FALSE
  END AS is_mismatch,
  mv.volatility_pct
FROM cities c
CROSS JOIN commodities cm
LEFT JOIN sp2kp_latest   sp    ON sp.city_id    = c.id AND sp.commodity_id    = cm.id
LEFT JOIN pedagang_agg   ped_d ON ped_d.city_id = c.id AND ped_d.commodity_id = cm.id
LEFT JOIN active_pairs   pair  ON pair.commodity_a_id = cm.id
LEFT JOIN pedagang_agg   ped_p ON ped_p.city_id = c.id AND ped_p.commodity_id = pair.commodity_b_id
                               AND ped_d.price IS NULL
LEFT JOIN monthly_vol    mv    ON mv.city_id     = c.id AND mv.commodity_id    = cm.id
WHERE sp.price IS NOT NULL OR ped_d.price IS NOT NULL OR ped_p.price IS NOT NULL;
```

### SQL Functions untuk Section B
```sql
-- Komoditas hanya di SP2KP (tidak ada di pedagang, direct atau via pair)
CREATE FUNCTION get_sp2kp_only_commodities()
RETURNS TABLE(commodity_id uuid, commodity_name text, city_count bigint) AS $$
  SELECT cm.id, cm.name, COUNT(DISTINCT pr.city_id)
  FROM commodities cm
  JOIN prices_raw pr ON pr.commodity_id = cm.id
    AND pr.source = 'sp2kp' AND pr.city_id IS NOT NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM pedagang_harga ph WHERE ph.commodity_id = cm.id
  ) AND NOT EXISTS (
    SELECT 1 FROM commodity_pairs cp
    WHERE (cp.commodity_a_id = cm.id OR cp.commodity_b_id = cm.id)
      AND cp.approved_at IS NOT NULL
  )
  GROUP BY cm.id, cm.name;
$$ LANGUAGE SQL;

-- Komoditas hanya di Pedagang
CREATE FUNCTION get_pedagang_only_commodities()
RETURNS TABLE(commodity_id uuid, commodity_name text, pedagang_count bigint) AS $$
  SELECT cm.id, cm.name, COUNT(DISTINCT ph.pedagang_id)
  FROM commodities cm
  JOIN pedagang_harga ph ON ph.commodity_id = cm.id
  WHERE NOT EXISTS (
    SELECT 1 FROM prices_raw pr
    WHERE pr.commodity_id = cm.id AND pr.source = 'sp2kp' AND pr.city_id IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM commodity_pairs cp
    WHERE (cp.commodity_a_id = cm.id OR cp.commodity_b_id = cm.id)
      AND cp.approved_at IS NOT NULL
  )
  GROUP BY cm.id, cm.name;
$$ LANGUAGE SQL;
```

---

## 7. NAMING AGENT — COMMODITY (3 JALUR)

```typescript
// lib/naming-agent.ts

export async function runCommodityReview() {
  // JALUR 1: Typo dari prices_raw (commodity_id IS NULL)
  const rawPending = await getPendingCommodityRaw()
  for (const item of rawPending) {
    if (await inNamingQueue('commodity', item.commodity_raw)) continue
    const result = await matchCommodity(item.commodity_raw)
    const subtype = result.score < 0.30 ? 'new' : 'typo'
    if (result.score >= 0.95 && result.method === 'exact') {
      await autoApprove('commodity', item, result)
    } else {
      await insertQueue({ type:'commodity', review_subtype: subtype, ...result })
    }
  }

  // JALUR 2: Pedagang-only commodity → pair suggestion
  const pedagangOnly = await getPedagangOnlyCommodities()
  const sp2kpList = await getSP2KPCommodities()
  for (const pedComm of pedagangOnly) {
    if (await inNamingQueue('commodity', pedComm.name)) continue
    const best = await findBestPair(pedComm, sp2kpList)
    await insertQueue({
      type: 'commodity',
      review_subtype: best.score > 0.30 ? 'pair' : 'new',
      raw_value: pedComm.name,
      canonical_id: pedComm.id,
      pair_target_id: best.id,        // null jika score rendah
      similarity_score: best.score,
      suggestion: best.name,
      method: best.method
    })
  }
}

// Matching: exact → fuzzy → Gemini (sama dengan city naming)
async function matchCommodity(raw: string) { ... }

// Approve typo → UPDATE prices_raw
async function approveTypo(queueId: string) { ... }

// Approve pair → INSERT commodity_pairs
async function approvePair(queueId: string, pairType: string, note?: string) {
  const item = await getQueueItem(queueId)
  await supabase.from('commodity_pairs').insert({
    commodity_a_id: item.canonical_id,
    commodity_b_id: item.pair_target_id,
    similarity_score: item.similarity_score,
    pair_type: pairType,
    approved_at: new Date().toISOString(),
    notes: note
  })
  await markApproved(queueId)
  // Trigger Phase A arbitrase — data baru mungkin masuk ke komparasi
}

// Approve new → komoditas confirm masuk Section B
async function approveAsNew(queueId: string) {
  await markApproved(queueId, 'Komoditas baru, masuk Section B')
}
```

---

## 8. ADMIN UI — COMMODITY QUEUE TAMPILAN

**Typo:**
```
📝 "Cabe Merah Kriting" → Cabai Merah Keriting
Source: SP2KP · 234 rows · Confidence: 0.92
[✓ Approve] [✕ Reject] [✎ Edit]
```

**Pair suggestion:**
```
🔗 USULAN PAIRING LINTAS SOURCE
"Cabai Hijau Besar" (Pedagang, 4 pedagang) similarity 0.62 ↔ "Cabai Merah Besar" (SP2KP)
Harga: Pedagang avg Rp 48.000 · SP2KP Rp 45.000 · Selisih 6.7%
Agent: "Berbeda jenis cabai, harga mirip. Comparable untuk perbandingan umum."
[✓ Sama (exact)] [~ Comparable] [✕ Reject → Section B] [✎ Catatan]
```

**Komoditas baru:**
```
🆕 "Jahe Merah" — tidak ada padanan (score < 0.30)
Source: Pedagang · 2 pedagang · Bandung
Agent: "Jahe tidak ada di SP2KP. Masuk Section B sampai ada source lain."
[✓ Konfirmasi ke Section B] [✕ Reject]
```

---

## 9. FOLDER STRUCTURE

```
commodity-dashboard/
├── CLAUDE.md
├── .claude/
│   ├── WORKBENCH.md
│   └── commands/
│       ├── debug.md
│       ├── upload-csv.md
│       ├── run-naming-agent.md
│       ├── run-arbitrage.md
│       └── review-naming.md
├── docs/
│   ├── schema.md
│   ├── data-flow.md
│   ├── sp2kp-csv-format.md
│   ├── naming-agent.md
│   ├── commodity-pairing.md        ← NEW
│   ├── arbitrage-engine.md
│   └── error-known.md
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── ingest/sp2kp/route.ts
    │   │   ├── admin/
    │   │   │   ├── naming/
    │   │   │   │   ├── run/route.ts
    │   │   │   │   ├── queue/route.ts
    │   │   │   │   ├── approve/route.ts
    │   │   │   │   └── reject/route.ts
    │   │   │   └── commodity/
    │   │   │       ├── run/route.ts
    │   │   │       ├── queue/route.ts
    │   │   │       ├── approve/route.ts    ← handle typo + pair + new
    │   │   │       └── reject/route.ts
    │   │   ├── csv/preview/route.ts
    │   │   ├── komparasi/route.ts          ← query VIEW + RPC Section B
    │   │   ├── prices/route.ts
    │   │   ├── transport/route.ts
    │   │   ├── distances/route.ts
    │   │   └── arbitrage/
    │   │       ├── route.ts
    │   │       ├── compute/route.ts
    │   │       ├── ai/route.ts
    │   │       └── manual/route.ts
    │   └── dashboard/
    │       ├── layout.tsx
    │       ├── sp2kp/page.tsx
    │       ├── pedagang/page.tsx
    │       ├── komparasi/page.tsx          ← Section A + Section B
    │       ├── arbitrase/ai/page.tsx
    │       ├── arbitrase/manual/page.tsx
    │       └── admin/
    │           ├── naming/page.tsx
    │           ├── commodity/page.tsx      ← 3 tampilan: typo/pair/new
    │           ├── ingest-log/page.tsx
    │           ├── cities/page.tsx
    │           └── commodities/page.tsx
    ├── components/
    │   ├── admin/
    │   │   ├── NamingQueue.tsx
    │   │   ├── CommodityQueue.tsx          ← 3 card variant
    │   │   ├── CommodityPairCard.tsx       ← pair suggestion UI
    │   │   ├── IngestLog.tsx
    │   │   └── PendingBadge.tsx
    │   ├── komparasi/
    │   │   ├── SectionA.tsx               ← paired accordion
    │   │   ├── SectionB.tsx               ← exclusive cards
    │   │   └── PairBadge.tsx              ← "via pair: xxx" badge
    │   ├── accordion/Level1Row Level2Row AccordionList
    │   ├── chart/PriceChart ChartPanel MiniSparkline
    │   ├── pills/ChangePill VolatilityPill MismatchBadge
    │   ├── csv/CSVUploader CSVPreviewTable
    │   ├── pedagang/PedagangTable PedagangForm KontakCell
    │   ├── transport/TransportTable TransportForm
    │   ├── arbitrage/ArbitrageCard ArbitrageList ArbitrageFilters
    │   │             ManualCalculator ManualLegRow ChainSummary
    │   └── shared/EmptyState FilterBar ColHeader AnomalyBanner
    ├── lib/
    │   ├── supabase.ts
    │   ├── osrm.ts
    │   ├── naming-agent.ts                 ← city + commodity (3 jalur)
    │   ├── queries/
    │   │   ├── prices.ts komparasi.ts pedagang.ts
    │   │   ├── transport.ts distances.ts naming.ts arbitrage.ts
    │   │   └── section-b.ts                ← query RPC functions
    │   ├── analytics/
    │   │   ├── volatility.ts mismatch.ts
    │   │   ├── arbitrage-engine.ts manual-arbitrage.ts
    │   ├── csv/sp2kp-parser.ts
    │   ├── gemini.ts
    │   └── utils/format-rupiah.ts date.ts
    ├── types/
    │   ├── prices.ts pedagang.ts transport.ts
    │   ├── komparasi.ts naming.ts arbitrage.ts
    │   └── commodity-pair.ts               ← NEW
    └── supabase/migrations/
        ├── 001_schema_core.sql             ← cities, commodities, prices_raw
        ├── 002_schema_admin.sql            ← naming_queue (updated), commodity_pairs
        ├── 003_schema_pedagang.sql
        ├── 004_schema_transport.sql
        ├── 005_schema_arbitrage.sql
        ├── 006_view_komparasi.sql          ← VIEW dengan COALESCE pair
        ├── 007_functions_section_b.sql     ← RPC functions
        ├── 008_seed_commodities.sql        ← 17 SP2KP (is_sp2kp=true)
        └── 009_seed_cities.sql
```

---

## 10. BUILD PHASES

### Phase 1 — Foundation + SP2KP
1. CLAUDE.md + WORKBENCH.md + migrations 001-009
2. sp2kp-parser.ts + CSV upload flow
3. Layout + 4 tab routing
4. Tab SP2KP: accordion + chart (HET hanya di chart detail, tidak di row)
5. Seed kota (Nominatim 1x)

### Phase 2 — Naming Agent + Admin
1. naming-agent.ts: city + commodity 3 jalur
2. Admin routes + pages
3. NamingQueue + CommodityQueue UI (3 card variant untuk commodity)
4. commodity_pairs table + approve flows
5. Tab Pedagang: form + EmptyState

### Phase 3 — Komparasi Clean Data
1. komparasi_harga VIEW (dengan COALESCE pair)
2. Section B RPC functions
3. Tab Komparasi: Section A (accordion) + Section B (cards)
4. PairBadge component
5. Transport tab + OSRM

### Phase 4 — Arbitrase
1. arbitrage-engine.ts Phase A (dari komparasi VIEW — Section A only)
2. Manual Calculator multi-leg
3. Phase B: + transport cost
4. Phase C: Gemini AI

---

## 11. EDGE CASES

| Situasi | Behavior |
|---------|----------|
| HET/HA kosong di CSV | het_ha = null, chart tidak tampilkan reference line |
| Komoditas pedagang tidak di SP2KP | Agent jalur 2: suggest pair, admin decide |
| Pair di-approve: komparasi langsung update | VIEW query COALESCE → data muncul di Section A |
| Pair di-reject | Komoditas masuk Section B |
| Arbitrase: komoditas Section B | Tidak masuk (tidak ada spread cross-source) |
| City baru dari future source | Naming queue jalur city, sama seperti SP2KP |
| Pedagang input komoditas baru via form | commodity_id dipilih dari dropdown — masuk pedagang_harga langsung |
| Future source punya komoditas yang ada di SP2KP | Nama mungkin beda → naming agent jalur 1 (typo/variasi) |
| Future source punya komoditas baru | Naming agent jalur 3 (new) → Section B |
