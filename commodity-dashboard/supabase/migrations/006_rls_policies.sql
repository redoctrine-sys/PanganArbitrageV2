-- ═══════════════════════════════════════
-- 006 — Row Level Security policies
-- Supabase project baru DEFAULT RLS ON. Tanpa policy, anon key gagal SELECT
-- → UI tampil empty walaupun data ada di DB.
--
-- Policy untuk Phase 1 (SP2KP raw display):
--   - SELECT cities/commodities: public.
--   - SELECT prices_raw: public, kondisi source='sp2kp' AND kode_wilayah IS
--     NOT NULL AND commodity_id IS NOT NULL. Tidak gating pada city_id —
--     itu dipakai Phase 2 untuk cross-source canonicalization.
--   - INSERT/UPDATE/DELETE: hanya service_role (dipakai di /api/ingest).
-- ═══════════════════════════════════════

-- Enable RLS (idempotent)
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

-- ── prices_raw: public read SP2KP raw ─────
-- SP2KP source = raw display, no approval gate. Phase 2 sources akan punya
-- policy sendiri (mis. pedagang_public_read dengan rules berbeda).
DROP POLICY IF EXISTS prices_raw_public_read_approved ON prices_raw;
DROP POLICY IF EXISTS prices_raw_public_read_sp2kp ON prices_raw;
CREATE POLICY prices_raw_public_read_sp2kp ON prices_raw
  FOR SELECT
  USING (
    source = 'sp2kp'
    AND kode_wilayah IS NOT NULL
    AND commodity_id IS NOT NULL
  );

-- ── INSERT/UPDATE/DELETE: tidak ada policy → DEFAULT DENY untuk anon. ──
-- service_role bypass RLS otomatis (dipakai di /api/ingest/sp2kp route).
