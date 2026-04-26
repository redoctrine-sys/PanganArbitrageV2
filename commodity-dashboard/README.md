# commodity-dashboard

PanganArbitrage Phase 1 — Tab SP2KP end-to-end (upload → ingest → display).
End-state target: `pangan-summary-v6.md`. UI/UX based on `pangan-v8.html` mockup.

## Setup lokal

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase project credentials
```

Run migrations di Supabase SQL editor.

**Cara cepat (recommended)**: paste seluruh isi `supabase/setup.sql` ke SQL Editor → Run. Idempotent, aman re-run.

**Cara manual** (per-file, urut):

1. `supabase/migrations/001_schema_core.sql`        — cities, commodities, prices_raw + index
2. `supabase/migrations/002_seed_commodities.sql`   — seed 17 komoditas SP2KP
3. `supabase/migrations/003_get_sp2kp_latest_fn.sql` — RPC untuk display layer
4. `supabase/migrations/004_auto_seed_cities.sql`   — auto-seed cities dari kode_wilayah BPS
5. `supabase/migrations/005_bulk_insert_fn.sql`     — chunked bulk insert RPC
6. `supabase/migrations/006_rls_policies.sql`       — Row Level Security policies

## Develop

```bash
npm run dev          # http://localhost:3000 → redirects to /dashboard/sp2kp
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

## Deploy ke Vercel

### 1. Siapkan project Supabase
- Buat project baru di https://supabase.com (free tier OK).
- Settings → API → copy:
  - **Project URL** (`https://xxxxx.supabase.co`)
  - **anon public key** (eyJ...)
  - **service_role key** (eyJ...) — **rahasia, jangan commit/share**
- SQL Editor → run 6 migration di atas, urut.

### 2. Connect repo ke Vercel
- https://vercel.com/new → Import `redoctrine-sys/PanganArbitrageV2`
- **Root Directory**: `commodity-dashboard` ⚠️ (harus diset, repo punya subfolder)
- Framework Preset: Next.js (auto-detected)

### 3. Environment variables di Vercel

| Key                              | Value                  | Scope                |
|----------------------------------|------------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Project URL Supabase   | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | anon public key        | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY`      | service_role key       | Production + Preview |

Lalu klik **Deploy**.

### 4. Smoke test

Setelah deploy, buka URL Vercel → harus redirect ke `/dashboard/sp2kp`:

- [ ] Tampil empty state "Belum ada data SP2KP yang approved" (DB kosong)
- [ ] Klik **Upload SP2KP** di topbar → modal terbuka
- [ ] Drop / pilih file `data sp2kp.csv` → preview dialog tampil:
  - Total baris file ≈ 7,829
  - Pasangan kota×komoditas ≈ 2,132
  - Kota unik ≈ 133
  - Akan diinsert ≈ 155,754 (jika DB kosong)
- [ ] Klik **✓ Ingest** → tunggu ~6-10 detik → modal close, page reload
- [ ] Setelah reload: 133 kota tampil, expand salah satu (mis. Kota Yogyakarta) → 17 komoditas dgn harga rupiah utuh (Rp 35.000 dst.)
- [ ] Klik komoditas → chart muncul dengan garis harga + (opsional) garis HET merah putus

## Upload berkala

Aman dilakukan kapanpun — architecture-nya idempotent:

- `prices_raw` punya `UNIQUE(date, city_raw, commodity_raw, source)` + `ON CONFLICT DO NOTHING`
- Re-upload file yang sama → semua row di-skip (preview menampilkan "Duplikat di-skip")
- Tanggal baru → masuk; tanggal lama (sudah ada di DB) → skip
- Kota baru (jarang, hanya jika SP2KP tambah scope) → auto-seeded
- 30-day stats di RPC `get_sp2kp_latest()` ikut tanggal terbaru di DB → otomatis update

Pola yang didukung: harian / mingguan / bulanan, semua aman.

### Batas ukuran file

- Vercel function body limit: **4.5 MB** per request
- File SP2KP yearly cumulative: ~3 MB → aman dengan margin
- File > 4.5 MB → split per kuartal/tahun, upload bertahap (data overlap aman karena duplicate skip)

## Phase 1 scope

- ✅ Tab SP2KP: upload CSV/XLSX, preview, ingest server-side, accordion (kota → komoditas → chart)
- ✅ Auto-seed 133 kab/kota dari kode wilayah BPS — no manual seeding/naming agent
- ✅ HET/HA reference line on chart, anomaly highlighting if price > HET
- ✅ Filter: search, island (Jawa/Madura/Bali/Lombok), province
- ✅ Server-side ingest dengan chunked bulk RPC — fit Vercel function timeout
- ⏳ Tab Pedagang, Komparasi, Arbitrase, Admin → Phase 2+ (placeholders)
- ⏳ Naming queue, commodity pairing, arbitrage engine → Phase 2+

## Files

- `src/lib/csv/sp2kp-parser.ts` — XLSX/CSV parser (DD/MM/YYYY + Excel serial dates, scale × 1000)
- `src/lib/analytics/metrics.ts` — change %, volatility, vsAvg, trend
- `src/components/sp2kp/SP2KPPage.tsx` — main accordion layout
- `src/components/sp2kp/ChartPanel.tsx` — Recharts line chart + HET reference + 30-day stats
- `src/components/csv/CSVUploader.tsx` — modal with preview flow (server-side ingest)
- `CLAUDE.md` + `.claude/WORKBENCH.md` — agent memory

## SP2KP file format

Upload supports `.xlsx`, `.xls`, `.csv` (UTF-16 LE OK).
Required columns: `Kode Wilayah`, `Kabupaten Kota`, `Komoditas`, optional `HET/HA`,
plus per-day price columns either as `DD/MM/YYYY` strings or Excel date serials.

**Skala harga**: SP2KP simpan dalam ribu — cell `35` = Rp 35.000, `12.813` = Rp 12.813,
HET `41.5` = Rp 41.500. Parser kalikan ×1000 saat parse.

Scope filter: kode prefix `31`–`36` (Jawa, dengan Madura `3526`–`3529`),
`51` (Bali), `52` (NTB → only Lombok kab/kota).

## Troubleshooting

| Gejala | Penyebab | Fix |
|--------|----------|-----|
| Empty state setelah ingest | Migration 004 belum run | Run `004_auto_seed_cities.sql` |
| Ingest error "function bulk_insert_sp2kp_prices does not exist" | Migration 005 belum run | Run `005_bulk_insert_fn.sql` |
| Data tampil tapi UI kosong setelah F5 | RLS aktif tanpa policy | Run `006_rls_policies.sql` |
| 504 timeout saat ingest | Hobby tier 10s timeout | Upgrade Pro, atau split file SP2KP per minggu |
| 413 body too large | Versi lama yang kirim 22MB JSON | Pull commit terbaru, deploy ulang |
