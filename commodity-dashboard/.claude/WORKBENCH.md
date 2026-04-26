# WORKBENCH — Current Task
*Baca file ini PERTAMA setiap kali membuka project*

## Status Phase 1 — Ready for Vercel deploy
- [x] Step 0: Project setup + CLAUDE.md
- [x] Step 1: DB schema + seed migrations (`supabase/migrations/001..003`)
- [x] Step 2: `sp2kp-parser.ts` (DD/MM/YYYY + Excel serial + scale × 1000)
- [x] Step 3: API routes (preview + ingest + prices + latest)
- [x] Step 4: CSVUploader + preview modal
- [x] Step 5: SP2KP page + accordion (Level 1 + Level 2)
- [x] Step 6: ChartPanel (Recharts + HET reference line)
- [x] Step 7: Filter bar (search + island + province)
- [x] Step 8: Auto-seed cities (`004_auto_seed_cities.sql`, ingest route hook)
- [x] Step 9: Server-side ingest + chunked bulk RPC (`005_bulk_insert_fn.sql`)
- [x] Step 10: RLS policies (`006_rls_policies.sql`)
- [x] Step 11: Vercel deploy guide + `vercel.json`

## Task aktif
User setup Supabase + Vercel, run 6 migrations, deploy. Smoke test sesuai README.

## Next step (user)
1. Setup Supabase project, copy URL/anon/service-role.
2. Run migrations 001 → 006 di Supabase SQL editor.
3. Vercel: import repo, root dir = `commodity-dashboard`, set 3 env vars, Deploy.
4. Smoke test: upload `data sp2kp.csv`, verify 133 kota × 17 komoditas dengan rupiah utuh.

## Issues / blockers
- Tidak ada untuk Phase 1.

## Files dimodifikasi session ini
Lihat `git status` di root.
