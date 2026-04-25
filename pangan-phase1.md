# PanganArbitrage — Phase 1 Build Plan
**Fokus:** Tab SP2KP running end-to-end — upload, ingest, display  
**Target selesai:** Tab SP2KP functional sepenuhnya sebelum tab lain dibangun  
**Stack:** Next.js 15 App Router · TypeScript · Supabase · shadcn/ui · Recharts

---

## ANALISIS FILE SP2KP AKTUAL (dari XLSX yang diupload)

### Format file (confirmed dari file nyata)
```
File: Tabulasi_SP2KP.XLSX (dan .CSV versi UTF-16 LE)
Shape: 7.772 rows × 18 kolom
Format: WIDE — satu baris = satu kota × komoditas, kolom = tanggal harian
```

### Struktur kolom persis
```
No | Kode Wilayah | Provinsi | Kabupaten Kota | Komoditas | HET/HA | 06/04/2026 | 07/04/2026 | ... | 21/04/2026
```

**Critical gotcha — kolom ada trailing space:**
- `'Komoditas '` (ada spasi di belakang) → parser WAJIB `.strip()` semua column names
- `'HET/HA '` (ada spasi) → sama

### 17 Komoditas SP2KP (nama exact, sudah confirmed)
```
Bawang Merah · Bawang Putih Honan · Beras Medium · Beras Premium
Cabai Merah Besar · Cabai Merah Keriting · Cabai Rawit Merah
Daging Ayam Ras · Daging Sapi Paha Belakang · Garam Halus
Gula Pasir Curah · Ikan Kembung · Minyak Goreng Sawit Curah
Minyak Goreng Sawit Kemasan Premium · Minyakita · Telur Ayam Ras
Tepung Terigu
```

### Data harga
- **dtype:** `float64` — harga sudah angka, tidak ada "Rp" prefix, tidak ada titik ribuan
- **HET/HA:** 720 null dari 7.772 rows (~9%) — kolom nullable, normal
- **Harga harian:** hanya 4 null dari 2.207 rows scope — sangat clean
- **Contoh nilai:** `40000.0`, `14350.0`, `23333.33` (rata-rata mingguan)

### Scope wilayah (confirmed)
- **Jawa:** kode prefix `31`(DKI) `32`(Jabar) `33`(Jateng) `34`(DIY) `35`(Jatim) `36`(Banten)
- **Madura:** kode `3526` `3527` `3528` `3529` → dalam prefix 35, override island='Madura'
  - Kab. Bangkalan, Kab. Sampang, Kab. Pamekasan, Kab. Sumenep
- **Bali:** prefix `51`
- **Lombok only (dari NTB prefix 52):**
  - ✅ Include: Kab. Lombok Barat, Kab. Lombok Tengah, Kab. Lombok Timur, Kab. Lombok Utara, Kota Mataram
  - ❌ Exclude: Kab. Bima, Kab. Dompu, Kab. Sumbawa, Kab. Sumbawa Barat, Kota Bima
- **Total dalam scope:** 2.207 rows, 138 kota/kab

### Tanggal dalam file ini
```
06/04/2026, 07/04/2026, 08/04/2026, 09/04/2026, 10/04/2026,
13/04/2026, 14/04/2026, 15/04/2026, 16/04/2026, 17/04/2026,
20/04/2026, 21/04/2026
→ Format: DD/MM/YYYY → convert ke YYYY-MM-DD untuk DB
→ Tidak ada hari libur: skip Sabtu-Minggu wajar
```

---

## PHASE 1 — STEP BY STEP BUILD

### Step 0: Setup Project (sebelum mulai)
```bash
npx create-next-app@latest commodity-dashboard --typescript --tailwind --app
cd commodity-dashboard
npx shadcn@latest init
npx shadcn@latest add button input select card table badge dialog
npm install @supabase/supabase-js recharts xlsx
```

**Buat file memory dulu sebelum coding apapun:**
```
commodity-dashboard/
├── CLAUDE.md          ← tulis sekarang
└── .claude/
    └── WORKBENCH.md   ← tulis sekarang
```

---

### Step 1: Database Schema (jalankan di Supabase SQL editor)

```sql
-- ═══════════════════════════════════════
-- MIGRATION 001: Core tables
-- ═══════════════════════════════════════

-- Kota/kabupaten canonical
CREATE TABLE cities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  name_sp2kp   text,             -- nama persis di file SP2KP: "Kota Bandung", "Kab. Bangkalan"
  province     text,
  island       text CHECK (island IN ('Jawa','Madura','Bali','Lombok')),
  entity_type  text CHECK (entity_type IN ('kota','kabupaten')),
  kode_wilayah text UNIQUE,      -- kode BPS 4 digit sebagai string
  lat          numeric(9,6),
  lng          numeric(9,6)
);

-- 17 komoditas SP2KP
CREATE TABLE commodities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  unit          text DEFAULT 'kg',
  category      text CHECK (category IN ('bumbu','pokok','protein')),
  is_sp2kp      boolean DEFAULT true,
  source_origin text DEFAULT 'sp2kp'
);

-- Staging: semua harga masuk ke sini dulu (INSERT ONLY)
CREATE TABLE prices_raw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  city_raw      text NOT NULL,          -- nama persis dari file
  commodity_raw text NOT NULL,          -- nama persis dari file
  city_id       uuid REFERENCES cities(id),         -- NULL = belum di-approve
  commodity_id  uuid REFERENCES commodities(id),    -- NULL = belum di-approve
  price         numeric(12,2) NOT NULL,
  het_ha        numeric(12,2),          -- nullable, banyak yang kosong
  source        text NOT NULL DEFAULT 'sp2kp',
  kode_wilayah  text,                   -- simpan untuk city matching
  created_at    timestamptz DEFAULT now(),
  
  -- Tidak boleh duplikat ingest
  UNIQUE(date, city_raw, commodity_raw, source)
);

-- Index untuk performa query
CREATE INDEX idx_pr_date     ON prices_raw(date DESC);
CREATE INDEX idx_pr_source   ON prices_raw(source);
CREATE INDEX idx_pr_approved ON prices_raw(city_id, commodity_id, date DESC)
  WHERE city_id IS NOT NULL AND commodity_id IS NOT NULL;
-- Index untuk deteksi pending
CREATE INDEX idx_pr_city_null ON prices_raw(city_id) WHERE city_id IS NULL;
CREATE INDEX idx_pr_comm_null ON prices_raw(commodity_id) WHERE commodity_id IS NULL;
```

```sql
-- ═══════════════════════════════════════
-- MIGRATION 002: Seed 17 komoditas SP2KP
-- ═══════════════════════════════════════
INSERT INTO commodities (name, unit, category, is_sp2kp) VALUES
  ('Bawang Merah',                       'kg',    'bumbu',   true),
  ('Bawang Putih Honan',                 'kg',    'bumbu',   true),
  ('Beras Medium',                       'kg',    'pokok',   true),
  ('Beras Premium',                      'kg',    'pokok',   true),
  ('Cabai Merah Besar',                  'kg',    'bumbu',   true),
  ('Cabai Merah Keriting',               'kg',    'bumbu',   true),
  ('Cabai Rawit Merah',                  'kg',    'bumbu',   true),
  ('Daging Ayam Ras',                    'kg',    'protein', true),
  ('Daging Sapi Paha Belakang',          'kg',    'protein', true),
  ('Garam Halus',                        'kg',    'pokok',   true),
  ('Gula Pasir Curah',                   'kg',    'pokok',   true),
  ('Ikan Kembung',                       'kg',    'protein', true),
  ('Minyak Goreng Sawit Curah',          'liter', 'pokok',   true),
  ('Minyak Goreng Sawit Kemasan Premium','liter', 'pokok',   true),
  ('Minyakita',                          'liter', 'pokok',   true),
  ('Telur Ayam Ras',                     'kg',    'protein', true),
  ('Tepung Terigu',                      'kg',    'pokok',   true);
```

---

### Step 2: Parser SP2KP (`src/lib/csv/sp2kp-parser.ts`)

**Input:** File dari user (XLSX atau CSV)  
**Output:** Array of parsed rows siap INSERT ke `prices_raw`

```typescript
// src/lib/csv/sp2kp-parser.ts

import * as XLSX from 'xlsx'

// Kode wilayah Madura — harus di-override island ke 'Madura'
const MADURA_CODES = ['3526', '3527', '3528', '3529']

// Kota NTB yang include (Lombok only)
const LOMBOK_INCLUDE = [
  'Kab. Lombok Barat', 'Kab. Lombok Tengah', 'Kab. Lombok Timur',
  'Kab. Lombok Utara', 'Kota Mataram'
]

// Prefix kode wilayah yang masuk scope
const SCOPE_PREFIXES = ['31','32','33','34','35','36','51','52']

export interface ParsedRow {
  date: string           // YYYY-MM-DD
  city_raw: string       // persis dari file
  commodity_raw: string  // persis dari file
  price: number
  het_ha: number | null
  kode_wilayah: string
}

export interface ParseResult {
  rows: ParsedRow[]
  dates_found: string[]        // tanggal yang ditemukan di file
  total_rows_file: number      // total rows di file
  total_rows_scope: number     // setelah filter wilayah
  rows_inserted: number        // setelah buang duplikat (diisi setelah DB check)
  duplicates_skipped: number
  new_cities: string[]         // city_raw yang belum ada di cities table
  warnings: string[]
}

export function parseSP2KP(fileBuffer: ArrayBuffer): Omit<ParseResult, 'rows_inserted' | 'duplicates_skipped' | 'new_cities'> {
  const warnings: string[] = []
  
  // Read workbook (support XLSX dan CSV)
  const wb = XLSX.read(fileBuffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  
  // Convert to array of arrays
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null })
  if (raw.length < 2) throw new Error('File kosong atau tidak valid')
  
  // Parse header row — strip whitespace dari semua nama kolom
  const header = (raw[0] as any[]).map(h => String(h ?? '').trim())
  
  // Temukan index kolom penting
  const idxKode      = header.findIndex(h => h === 'Kode Wilayah')
  const idxKota      = header.findIndex(h => h === 'Kabupaten Kota')
  const idxKomoditas = header.findIndex(h => h === 'Komoditas')
  const idxHet       = header.findIndex(h => h === 'HET/HA')
  
  if (idxKode < 0 || idxKota < 0 || idxKomoditas < 0) {
    throw new Error('Header tidak valid — pastikan file adalah Tabulasi SP2KP yang benar')
  }
  
  // Temukan kolom tanggal (format DD/MM/YYYY)
  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/
  const dateColumns: { idx: number; dateStr: string }[] = []
  header.forEach((h, i) => {
    if (datePattern.test(h)) {
      // Convert DD/MM/YYYY → YYYY-MM-DD
      const [dd, mm, yyyy] = h.split('/')
      dateColumns.push({ idx: i, dateStr: `${yyyy}-${mm}-${dd}` })
    }
  })
  
  if (dateColumns.length === 0) {
    throw new Error('Tidak ditemukan kolom tanggal (format DD/MM/YYYY) di file')
  }
  
  const dates_found = dateColumns.map(d => d.dateStr)
  const total_rows_file = raw.length - 1  // exclude header
  
  const parsedRows: ParsedRow[] = []
  
  // Process data rows
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as any[]
    if (!row || row.length === 0) continue
    
    const kodeWilayah = String(row[idxKode] ?? '').trim()
    const cityRaw     = String(row[idxKota] ?? '').trim()
    const commRaw     = String(row[idxKomoditas] ?? '').trim()
    
    if (!kodeWilayah || !cityRaw || !commRaw) continue
    
    // Filter scope
    const prefix = kodeWilayah.substring(0, 2)
    if (!SCOPE_PREFIXES.includes(prefix)) continue
    
    // Filter Lombok vs Sumbawa (NTB prefix 52)
    if (prefix === '52' && !LOMBOK_INCLUDE.includes(cityRaw)) continue
    
    // Parse HET/HA
    const hetRaw = row[idxHet]
    const het_ha = hetRaw != null && !isNaN(Number(hetRaw))
      ? Number(hetRaw)
      : null
    
    // Parse satu row → N rows (satu per tanggal)
    for (const { idx, dateStr } of dateColumns) {
      const priceRaw = row[idx]
      if (priceRaw == null || priceRaw === '' || isNaN(Number(priceRaw))) {
        // Skip null harga, tidak perlu warning (hanya 4 dari 2207)
        continue
      }
      
      parsedRows.push({
        date: dateStr,
        city_raw: cityRaw,
        commodity_raw: commRaw,
        price: Number(priceRaw),
        het_ha,
        kode_wilayah: kodeWilayah
      })
    }
  }
  
  const total_rows_scope = new Set(
    parsedRows.map(r => `${r.city_raw}||${r.commodity_raw}`)
  ).size
  
  return {
    rows: parsedRows,
    dates_found,
    total_rows_file,
    total_rows_scope,
    warnings
  }
}
```

---

### Step 3: API Routes

#### `/api/csv/preview` — POST (parse tanpa insert)
```typescript
// src/app/api/csv/preview/route.ts
// Input: FormData dengan field 'file'
// Output: ParseResult preview (tanpa insert ke DB)

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  if (!file) return Response.json({ error: 'No file' }, { status: 400 })
  
  const buffer = await file.arrayBuffer()
  
  try {
    const result = parseSP2KP(buffer)
    
    // Check duplikat dari DB
    const supabase = createClient(...)
    const dateList = result.dates_found
    const cityList = [...new Set(result.rows.map(r => r.city_raw))]
    
    const { data: existing } = await supabase
      .from('prices_raw')
      .select('date, city_raw, commodity_raw')
      .in('date', dateList)
      .in('city_raw', cityList)
      .eq('source', 'sp2kp')
    
    const existingSet = new Set(
      (existing ?? []).map(e => `${e.date}||${e.city_raw}||${e.commodity_raw}`)
    )
    
    const duplicates_skipped = result.rows.filter(r =>
      existingSet.has(`${r.date}||${r.city_raw}||${r.commodity_raw}`)
    ).length
    
    // Check kota baru (belum di cities table)
    const { data: knownCities } = await supabase
      .from('cities')
      .select('name_sp2kp')
    
    const knownSet = new Set((knownCities ?? []).map(c => c.name_sp2kp))
    const uniqueCities = [...new Set(result.rows.map(r => r.city_raw))]
    const new_cities = uniqueCities.filter(c => !knownSet.has(c))
    
    return Response.json({
      ...result,
      rows: result.rows.slice(0, 10),   // preview 10 rows saja
      total_parsed: result.rows.length,
      duplicates_skipped,
      rows_will_insert: result.rows.length - duplicates_skipped,
      new_cities,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
```

#### `/api/ingest/sp2kp` — POST (insert ke DB)
```typescript
// src/app/api/ingest/sp2kp/route.ts
// Input: JSON body { rows: ParsedRow[] }
// Output: { inserted, skipped, new_cities_detected }

export async function POST(req: Request) {
  const { rows }: { rows: ParsedRow[] } = await req.json()
  
  const supabase = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  // Lookup commodity_id dari nama (sudah seeded, exact match)
  const { data: commodities } = await supabase
    .from('commodities')
    .select('id, name')
    .eq('is_sp2kp', true)
  
  const commMap = new Map(commodities!.map(c => [c.name, c.id]))
  
  // Lookup city_id dari kode_wilayah (paling reliable)
  const { data: cities } = await supabase
    .from('cities')
    .select('id, kode_wilayah, name_sp2kp')
  
  const cityByKode = new Map(cities!.map(c => [c.kode_wilayah, c.id]))
  const cityByName = new Map(cities!.map(c => [c.name_sp2kp, c.id]))
  
  // Build insert rows
  const toInsert = rows.map(r => ({
    date: r.date,
    city_raw: r.city_raw,
    commodity_raw: r.commodity_raw,
    price: r.price,
    het_ha: r.het_ha,
    source: 'sp2kp',
    kode_wilayah: r.kode_wilayah,
    // Auto-resolve jika bisa (kode wilayah exact match)
    city_id: cityByKode.get(r.kode_wilayah) ?? cityByName.get(r.city_raw) ?? null,
    commodity_id: commMap.get(r.commodity_raw) ?? null,
  }))
  
  // Batch insert, ON CONFLICT DO NOTHING
  const batchSize = 500
  let inserted = 0
  let skipped = 0
  
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('prices_raw')
      .upsert(batch, {
        onConflict: 'date,city_raw,commodity_raw,source',
        ignoreDuplicates: true
      })
      .select('id')
    
    if (error) {
      console.error('Ingest batch error:', error)
      continue
    }
    inserted += (data?.length ?? 0)
  }
  
  skipped = toInsert.length - inserted
  
  // Deteksi kota yang masih NULL city_id (perlu naming review)
  const new_cities_detected = [...new Set(
    toInsert.filter(r => r.city_id === null).map(r => r.city_raw)
  )]
  
  return Response.json({ inserted, skipped, new_cities_detected })
}
```

#### `/api/prices` — GET (query untuk display)
```typescript
// src/app/api/prices/route.ts
// Query params: ?date=YYYY-MM-DD&city_id=uuid&commodity_id=uuid&days=7

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const city_id = searchParams.get('city_id')
  const commodity_id = searchParams.get('commodity_id')
  const days = parseInt(searchParams.get('days') ?? '14')
  
  const supabase = createClient()
  
  let query = supabase
    .from('prices_raw')
    .select(`
      id, date, price, het_ha, city_raw, commodity_raw,
      city_id, commodity_id, source
    `)
    .eq('source', 'sp2kp')
    .not('city_id', 'is', null)          // HANYA approved
    .not('commodity_id', 'is', null)
    .gte('date', new Date(Date.now() - days * 86400000).toISOString().slice(0,10))
    .order('date', { ascending: false })
    .limit(2000)
  
  if (city_id) query = query.eq('city_id', city_id)
  if (commodity_id) query = query.eq('commodity_id', commodity_id)
  
  const { data, error } = await query
  if (error) return Response.json({ error }, { status: 500 })
  
  return Response.json({ data })
}
```

---

### Step 4: UI Components

#### 4A: CSV Uploader (`src/components/csv/CSVUploader.tsx`)

```
Flow UI:
1. Tombol "Upload SP2KP CSV/XLSX"
2. Klik → file picker (accept .xlsx, .csv, .xls)
3. Auto-call /api/csv/preview
4. Modal preview muncul:
   ┌─────────────────────────────────────────────┐
   │  Preview Upload SP2KP                       │
   │                                             │
   │  File: Tabulasi_SP2KP.XLSX                 │
   │  Total baris file: 7.772                   │
   │  Dalam scope Jawa+Bali+Lombok: 2.207        │
   │  Tanggal ditemukan: 06/04 s/d 21/04 (12hr) │
   │  Komoditas: 17 ✓                           │
   │  Kota baru terdeteksi: 0                   │
   │  Duplikat akan di-skip: 0                  │
   │  ─────────────────────────────────────────  │
   │  Akan diinsert: 2.207 × 12 = 26.484 rows   │
   │                                             │
   │  ⚠ 3 kota belum di-approve → naming queue  │
   │                                             │
   │  [Preview 10 baris ▾]                      │
   │  date       | kota       | komoditas | harga│
   │  2026-04-06 | Bandung    | Cabai Rawit| 48k │
   │  ...                                        │
   │                                             │
   │  [Cancel]              [✓ Ingest Sekarang]  │
   └─────────────────────────────────────────────┘
5. Klik Ingest → POST /api/ingest/sp2kp
6. Toast: "26.484 rows berhasil. 3 kota pending review admin."
```

#### 4B: Layout Tab SP2KP

```
Tab SP2KP
├── Tab Header (sticky)
│   ├── Stat cards: Kab/Kota | Komoditas | Pending Review | Data Terbaru
│   └── Sub-tabs: [By City] [By Commodity]
│
├── Filter Bar
│   ├── Search input
│   ├── Filter Pulau: [Semua][Jawa][Madura][Bali][Lombok]
│   ├── Filter Provinsi (dropdown)
│   └── Filter Tanggal (date range picker)
│
└── Content: Accordion 2 Level
    ├── Level 1: Kota row (collapsed by default)
    │   Kolom: # | Nama Kota + Pulau | Harga Avg | Δ% | Vol | Trend
    └── Level 2: Komoditas row (expanded saat kota diklik)
        Kolom: # | Komoditas | Harga | Δ% | Vol | vs Avg
        └── Chart Panel (expanded saat komoditas diklik)
            ├── Chart kiri: Line chart + HET reference line (jika ada)
            └── Stats kanan: 8 metrics
```

#### 4C: Komponen Level 1 — Kota Row

```typescript
// Data yang dibutuhkan per kota (di-compute dari prices_raw):
interface CityRowData {
  city_id: string
  city_name: string          // dari cities.name
  province: string
  island: 'Jawa'|'Madura'|'Bali'|'Lombok'
  avg_price_latest: number   // avg semua komoditas, tanggal terbaru
  change_pct: number         // vs hari sebelumnya
  volatility: number         // (max-min)/avg dalam 30 hari
  trend: 'up'|'down'|'flat' // berdasarkan 7 hari terakhir
  commodity_count: number    // berapa komoditas ada datanya
  has_anomaly: boolean       // ada komoditas di atas HET
  anomaly_description: string // "Cabai Rawit, Bawang Putih anomali"
}
```

#### 4D: Komponen Level 2 — Komoditas Row

```typescript
interface CommodityRowData {
  commodity_id: string
  commodity_name: string
  category: string
  price_latest: number
  change_pct: number         // vs hari sebelumnya
  volatility: number
  vs_avg_pct: number         // vs avg 30 hari
  trend: 'up'|'down'|'flat'
  het_ha: number | null      // untuk display di chart
}
```

#### 4E: Chart Panel

```typescript
// Data untuk chart:
// GET /api/prices?city_id=xxx&commodity_id=xxx&days=30
// → array of { date, price, het_ha }

// Chart spec:
// - X axis: tanggal (format "dd MMM")
// - Y axis: harga Rp (format "Rp xx.xxx")
// - Line: harga SP2KP (warna hijau --sp)
// - Dashed horizontal: het_ha jika tidak null (warna merah)
// - Dashed horizontal: avg 30 hari (warna abu)
// - Tooltip: tanggal + harga + Δ%
// - Switcher: D (7 hari) | W (30 hari) | M (90 hari)
// - Recharts: LineChart + ReferenceLine untuk HET
```

---

### Step 5: Query untuk Display

```sql
-- Query harga terbaru per kota per komoditas (untuk accordion level 1 & 2)
-- Jalankan ini sebagai Supabase RPC function

CREATE OR REPLACE FUNCTION get_sp2kp_latest(
  p_island text DEFAULT NULL,
  p_province text DEFAULT NULL
)
RETURNS TABLE(
  city_id uuid,
  city_name text,
  province text,
  island text,
  commodity_id uuid,
  commodity_name text,
  category text,
  price_latest numeric,
  price_prev numeric,           -- harga hari sebelumnya untuk Δ%
  het_ha numeric,
  date_latest date,
  avg_30d numeric,              -- untuk vs avg
  max_30d numeric,              -- untuk volatility
  min_30d numeric
) AS $$
  WITH
    ranked AS (
      SELECT
        pr.city_id, pr.commodity_id,
        pr.price, pr.het_ha, pr.date,
        ROW_NUMBER() OVER (
          PARTITION BY pr.city_id, pr.commodity_id
          ORDER BY pr.date DESC
        ) AS rn
      FROM prices_raw pr
      WHERE pr.source = 'sp2kp'
        AND pr.city_id IS NOT NULL
        AND pr.commodity_id IS NOT NULL
    ),
    latest AS (SELECT * FROM ranked WHERE rn = 1),
    prev   AS (SELECT * FROM ranked WHERE rn = 2),
    stats  AS (
      SELECT
        city_id, commodity_id,
        AVG(price) AS avg_30d,
        MAX(price) AS max_30d,
        MIN(price) AS min_30d
      FROM prices_raw
      WHERE source = 'sp2kp'
        AND city_id IS NOT NULL
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY city_id, commodity_id
    )
  SELECT
    c.id  AS city_id,     c.name AS city_name,
    c.province,           c.island,
    cm.id AS commodity_id, cm.name AS commodity_name, cm.category,
    l.price AS price_latest,
    p.price AS price_prev,
    l.het_ha,
    l.date AS date_latest,
    s.avg_30d, s.max_30d, s.min_30d
  FROM latest l
  JOIN cities     c  ON c.id  = l.city_id
  JOIN commodities cm ON cm.id = l.commodity_id
  LEFT JOIN prev   p  ON p.city_id = l.city_id AND p.commodity_id = l.commodity_id
  LEFT JOIN stats  s  ON s.city_id = l.city_id AND s.commodity_id = l.commodity_id
  WHERE (p_island   IS NULL OR c.island   = p_island)
    AND (p_province IS NULL OR c.province = p_province);
$$ LANGUAGE SQL STABLE;
```

---

### Step 6: Cities Table — Seed Awal

Kota di-seed otomatis dari ingest pertama. Parser sudah tahu kode wilayah, nama, dan island dari CSV. Setelah ingest:

```typescript
// lib/cities-seeder.ts — jalankan sekali setelah ingest pertama

// Dari prices_raw yang city_id IS NULL, ambil distinct city_raw + kode_wilayah
// Auto-determine island dari kode:
function getIsland(kode: string): string {
  const prefix = kode.substring(0, 2)
  if (['3526','3527','3528','3529'].includes(kode)) return 'Madura'
  if (['31','32','33','34','35','36'].includes(prefix)) return 'Jawa'
  if (prefix === '51') return 'Bali'
  if (prefix === '52') return 'Lombok'
  return 'Jawa'
}

// Auto-determine entity_type dari nama:
function getEntityType(name: string): string {
  return name.startsWith('Kota') ? 'kota' : 'kabupaten'
}

// Setelah insert ke cities:
// UPDATE prices_raw SET city_id = [id] WHERE city_raw = [name_sp2kp]
```

**Koordinat lat/lng:** Seed via Nominatim (free) satu kali:
```typescript
// lib/geocode.ts — rate limit 1 req/detik
async function geocodeCity(name: string) {
  const q = encodeURIComponent(`${name} Indonesia`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PanganArbitrage/1.0' }
  })
  const data = await res.json()
  return data[0] ? { lat: +data[0].lat, lng: +data[0].lon } : null
}
// 138 kota × 1 detik = ~3 menit. Jalankan sekali, hasilnya simpan ke DB.
```

---

### Step 7: Computed Metrics (client-side, bukan DB)

Hitung di client dari data yang di-fetch — tidak perlu query tambahan:

```typescript
// lib/analytics/metrics.ts

export function calcChangePct(latest: number, prev: number | null): number | null {
  if (!prev || prev === 0) return null
  return ((latest - prev) / prev) * 100
}

export function calcVolatility(max: number, min: number, avg: number): number | null {
  if (!avg || avg === 0) return null
  return ((max - min) / avg) * 100
}

export function calcVsAvg(price: number, avg: number | null): number | null {
  if (!avg || avg === 0) return null
  return ((price - avg) / avg) * 100
}

export function calcTrend(prices: number[]): 'up' | 'down' | 'flat' {
  if (prices.length < 3) return 'flat'
  const recent = prices.slice(0, 3)
  const slope = recent[0] - recent[2]  // terbaru - 3 hari lalu
  if (Math.abs(slope / recent[2]) < 0.01) return 'flat'
  return slope > 0 ? 'up' : 'down'
}

export function formatRupiah(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n))
}
```

---

## FILE STRUCTURE PHASE 1

```
commodity-dashboard/
├── CLAUDE.md                          ← tulis sekarang (lihat di bawah)
├── .claude/
│   ├── WORKBENCH.md
│   └── commands/
│       ├── upload-csv.md
│       └── debug.md
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← redirect ke /dashboard/sp2kp
│   │   ├── api/
│   │   │   ├── csv/
│   │   │   │   └── preview/route.ts
│   │   │   ├── ingest/
│   │   │   │   └── sp2kp/route.ts
│   │   │   └── prices/route.ts
│   │   └── dashboard/
│   │       ├── layout.tsx             ← Topbar + Sidebar shell (tab lain placeholder)
│   │       └── sp2kp/page.tsx         ← Main page phase 1
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Topbar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── csv/
│   │   │   ├── CSVUploader.tsx        ← tombol + modal preview
│   │   │   └── CSVPreviewTable.tsx    ← tabel 10 baris preview
│   │   ├── sp2kp/
│   │   │   ├── SP2KPPage.tsx          ← container utama
│   │   │   ├── StatCards.tsx          ← 4 metric card di atas
│   │   │   ├── FilterBar.tsx          ← search + filter pulau + provinsi + tanggal
│   │   │   ├── CityAccordion.tsx      ← Level 1 list + logic
│   │   │   ├── CityRow.tsx            ← satu baris kota
│   │   │   ├── CommodityAccordion.tsx ← Level 2 list inside city
│   │   │   ├── CommodityRow.tsx       ← satu baris komoditas
│   │   │   └── ChartPanel.tsx         ← chart + stats panel
│   │   ├── charts/
│   │   │   └── PriceLineChart.tsx     ← Recharts wrapper
│   │   ├── pills/
│   │   │   ├── ChangePill.tsx
│   │   │   ├── VolatilityPill.tsx
│   │   │   └── MiniSparkline.tsx
│   │   └── shared/
│   │       └── EmptyState.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts                ← client + server client
│   │   ├── csv/
│   │   │   └── sp2kp-parser.ts        ← CRITICAL: parser XLSX/CSV
│   │   ├── analytics/
│   │   │   └── metrics.ts             ← calcChangePct, calcVol, formatRupiah
│   │   └── utils/
│   │       └── date.ts                ← format tanggal Indonesia
│   │
│   └── types/
│       ├── prices.ts
│       └── sp2kp.ts                   ← CityRowData, CommodityRowData, ParseResult
│
└── supabase/
    └── migrations/
        ├── 001_schema_core.sql
        ├── 002_seed_commodities.sql
        └── 003_get_sp2kp_latest_fn.sql
```

---

## CLAUDE.md (tulis ini sebelum mulai coding)

```markdown
# PanganArbitrage — Project Brain
Stack: Next.js 15 App Router · TypeScript · Supabase · shadcn/ui · Recharts
Deploy: Vercel

## Boot sequence
1. Baca .claude/WORKBENCH.md PERTAMA
2. Jangan auto-baca file lain sebelum dibutuhkan

## PHASE 1 SCOPE: Tab SP2KP saja
Fokus: upload CSV → parse → ingest → display accordion + chart
Tab lain (Pedagang, Komparasi, Arbitrase, Admin) = PLACEHOLDER dulu

## SP2KP Parser — KRITIS
File: src/lib/csv/sp2kp-parser.ts
- Support XLSX dan CSV (pakai library 'xlsx')
- Kolom WAJIB di-strip: 'Komoditas ' dan 'HET/HA ' ada trailing space di file asli
- Filter scope: prefix kode 31-36 (Jawa), 51 (Bali), 52+Lombok
- Madura: kode 3526-3529 → island='Madura' (tetap dalam prefix 35/Jatim)
- Lombok include: Kab. Lombok Barat/Tengah/Timur/Utara + Kota Mataram
- Lombok exclude: Kab/Kota Bima, Dompu, Sumbawa, Sumbawa Barat
- Harga dtype: float64, TIDAK ada prefix 'Rp', TIDAK ada titik ribuan
- HET/HA: 720/7772 null = normal, kolom nullable
- Tanggal format di file: DD/MM/YYYY → convert ke YYYY-MM-DD untuk DB

## DB rules
- prices_raw: INSERT ONLY, ON CONFLICT DO NOTHING
- UNIQUE: (date, city_raw, commodity_raw, source)
- Hanya data dengan city_id IS NOT NULL yang ditampilkan di UI
- commodity_id: 17 komoditas SP2KP sudah seeded → exact match selalu berhasil
- city_id: di-resolve dari kode_wilayah (paling reliable) atau name_sp2kp

## 17 Komoditas SP2KP (exact, sudah seed)
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras,
Tepung Terigu

## API routes (Phase 1)
- POST /api/csv/preview    ← parse file, return stats (NO insert)
- POST /api/ingest/sp2kp   ← insert rows ke prices_raw
- GET  /api/prices         ← query approved data untuk display

## Display logic
- Level 1 (kota): dari RPC get_sp2kp_latest(), group by city
- Level 2 (komoditas): dari RPC yang sama, filter by city_id
- Chart: GET /api/prices?city_id=&commodity_id=&days=30
- Semua metrics (changePct, volatility, vsAvg, trend) dihitung client-side
- HET/HA muncul HANYA sebagai ReferenceLine di chart, TIDAK di row list
- Accordion: only 1 kota open at a time, only 1 komoditas open per kota

## Performa
- RPC get_sp2kp_latest() dipanggil SEKALI saat page load dengan island filter
- Filter provinsi/kota dilakukan client-side dari data yang sudah di-fetch
- Chart data di-fetch on-demand saat komoditas di-expand (lazy load)
- Recharts dengan ResponsiveContainer, data max 90 hari

## Color tokens (dari v8 mockup)
--sp: #1b5e3b (SP2KP green)
--up: #166534, --up-bg: #dcfce7
--dn: #991b1b, --dn-bg: #fee2e2
--warn: #78350f, --warn-bg: #fef3c7
--hi: #9a3412, --hi-bg: #ffedd5
--lo: #14532d, --lo-bg: #dcfce7
```

---

## WORKBENCH.md Template

```markdown
# WORKBENCH — Current Task
*Baca file ini PERTAMA*

## Status Phase 1
- [ ] Step 0: Project setup + CLAUDE.md
- [ ] Step 1: DB schema + seed
- [ ] Step 2: sp2kp-parser.ts
- [ ] Step 3: API routes (preview + ingest + prices)
- [ ] Step 4: CSVUploader component
- [ ] Step 5: SP2KP page + accordion
- [ ] Step 6: Chart panel
- [ ] Step 7: Filter + search

## Task aktif
[tulis di sini]

## Step terakhir selesai
[tulis di sini]

## Next step
[tulis di sini]

## Issues / blockers
[tulis jika ada]

## Files dimodifikasi session ini
[list files]
```

---

## CHECKLIST SEBELUM PHASE 2

Sebelum lanjut ke tab Pedagang / Admin / Komparasi, pastikan:

- [ ] Upload CSV/XLSX berhasil → preview muncul dengan stats yang benar
- [ ] Ingest berhasil → data masuk ke prices_raw di Supabase
- [ ] Kota auto-resolved dari kode_wilayah → city_id terisi
- [ ] 17 komoditas exact match → commodity_id terisi
- [ ] Accordion By City: kota muncul, klik → komoditas list tampil
- [ ] Accordion By Commodity: komoditas muncul, klik → list kota tampil
- [ ] Chart: harga harian tampil, tooltip OK, HET reference line muncul jika ada
- [ ] Filter pulau: [Semua][Jawa][Madura][Bali][Lombok] berfungsi
- [ ] Metric cards: angka benar dari data yang ada
- [ ] Test upload file yang sama 2x → duplikat di-skip, tidak error
- [ ] Test file tanpa data scope (semua luar Jawa/Bali/Lombok) → empty state
```
