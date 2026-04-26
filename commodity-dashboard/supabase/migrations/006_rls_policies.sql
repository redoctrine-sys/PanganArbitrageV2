-- ═══════════════════════════════════════
-- 006 — Row Level Security policies
-- Supabase project baru DEFAULT RLS ON. Tanpa policy, anon key gagal SELECT
-- → UI tampil empty walaupun data ada di DB.
--
-- Policy untuk Phase 1:
--   - SELECT: public (anon + authenticated) bisa baca cities, commodities,
--     prices_raw approved (city_id NOT NULL AND commodity_id NOT NULL).
--   - INSERT/UPDATE/DELETE: hanya service_role (dipakai di /api/ingest server route).
-- ═══════════════════════════════════════

-- Enable RLS (idempotent kalau sudah on)
ALTER TABLE cities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices_raw  ENABLE ROW LEVEL SECURITY;

-- ── cities: public read ───────────────────
DROP POLICY IF EXISTS cities_public_read ON cities;
CREATE POLICY cities_public_read ON cities
  FOR SELECT
  USING (true);

-- ── commodities: public read ──────────────
DROP POLICY IF EXISTS commodities_public_read ON commodities;
CREATE POLICY commodities_public_read ON commodities
  FOR SELECT
  USING (true);

-- ── prices_raw: public read approved-only ─
-- UI hanya tampilkan row dengan city_id + commodity_id resolved.
-- Policy ini juga hide raw pending data dari client anon.
DROP POLICY IF EXISTS prices_raw_public_read_approved ON prices_raw;
CREATE POLICY prices_raw_public_read_approved ON prices_raw
  FOR SELECT
  USING (city_id IS NOT NULL AND commodity_id IS NOT NULL);

-- ── prices_raw: server-side preview/ingest needs full read for dup-check ──
-- Service role bypass RLS by default, tapi route preview pakai server client
-- (anon). Tambah policy authenticated read full untuk kasus future role.
-- Untuk Phase 1, /api/csv/preview dup-check → cukup pakai SELECT approved
-- (kalau ada row dengan kombinasi date+city+commodity sama, sudah pasti
-- approved karena ingest selalu set commodity_id).
-- → Tidak perlu tambah policy lain.

-- ── INSERT/UPDATE/DELETE: tidak ada policy → DEFAULT DENY untuk anon. ──
-- service_role bypass RLS otomatis (dipakai di /api/ingest/sp2kp route).
