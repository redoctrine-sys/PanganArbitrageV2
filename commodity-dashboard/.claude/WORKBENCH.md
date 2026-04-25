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

## Task aktif
Verifikasi end-to-end di Supabase nyata: jalankan migrations, upload `Tabulasi_SP2KP.XLSX`, cek 138 kota × 17 komoditas terdisplay benar.

## Step terakhir selesai
Initial scaffold Phase 1 — code structure lengkap, build hijau, masih perlu Supabase project + env utk running.

## Next step
1. Setup Supabase project, copy `.env.example` → `.env.local`, isi credential.
2. Jalankan migrations 001 → 002 → 003 di Supabase SQL editor.
3. Boot `npm run dev`, buka `/dashboard/sp2kp`, klik "Upload SP2KP", pilih file XLSX.
4. Verifikasi: preview dialog tampil dengan total rows / kota baru / duplikat.
5. Klik Ingest, pastikan `prices_raw` terisi.
6. Setelah ingest pertama: jalankan helper `seed_cities_from_raw()` (lihat docs/seed-cities.md TODO Phase 2).

## Issues / blockers
- Sebelum ada cities table terisi, semua row akan masuk pending — UI menampilkan empty state plus pesan "Belum ada kota di-approve". Phase 2 akan menyediakan flow auto-seed dari `prices_raw`.

## Files dimodifikasi session ini
Lihat `git status` di root.
