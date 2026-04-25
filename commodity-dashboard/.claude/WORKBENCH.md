# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*

## Status Phase 1
- [x] Step 0: Project setup + CLAUDE.md
- [x] Step 1: DB schema + seed migrations (`supabase/migrations/001..003`)
- [x] Step 2: `sp2kp-parser.ts`
- [x] Step 3: API routes (preview + ingest + prices + latest)
- [x] Step 4: CSVUploader + preview modal
- [x] Step 5: SP2KP page + accordion (Level 1 + Level 2)
- [x] Step 6: ChartPanel (Recharts + HET reference line)
- [x] Step 7: Filter bar (search + island + province)
- [x] Step 8: Auto-seed cities (`004_auto_seed_cities.sql`, ingest route hook)

## Task aktif
Deploy Phase 1 ke Vercel + Supabase, verifikasi end-to-end dgn real `Tabulasi_SP2KP.XLSX`.

## Step terakhir selesai
Auto-seed cities dari `prices_raw.kode_wilayah` (BPS) + backfill `city_id`. Setelah upload pertama,
133 kota tampil otomatis tanpa naming agent.

## Next step
1. Setup Supabase project, copy `.env.example` → `.env.local`, isi credential.
2. Jalankan migrations 001 → 002 → 003 → 004 di Supabase SQL editor.
3. Boot `npm run dev`, buka `/dashboard/sp2kp`, klik "Upload SP2KP", pilih file XLSX.
4. Verifikasi: preview dialog tampil dengan total rows / kota baru / duplikat.
5. Klik Ingest → response mencantumkan `cities_seeded` & `rows_backfilled`.
6. Reload page → 133 kota × 17 komoditas tampil.

## Issues / blockers
- Tidak ada untuk Phase 1.

## Files dimodifikasi session ini
Lihat `git status` di root.
