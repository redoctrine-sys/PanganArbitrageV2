-- ═══════════════════════════════════════════════════════════════════════════
-- PanganArbitrage Phase 1 — Supabase setup (consolidated migrations 001-006)
--
-- Idempotent: aman dijalankan berulang.
--
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor → New Query
--   2. Paste seluruh isi file ini → Run
--   3. Pastikan tidak ada error di output panel bawah
--   4. Verifikasi: panel "Database" → harus muncul tabel
--      cities, commodities, prices_raw — dan commodities sudah berisi 17 row.
--
-- Migration source (file individual, fungsi sama):
--   001_schema_core.sql
--   002_seed_commodities.sql
--   003_get_sp2kp_latest_fn.sql
--   004_auto_seed_cities.sql
--   005_bulk_insert_fn.sql
--   006_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════
-- 001 — Core tables: cities, commodities, prices_raw
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS cities (
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

CREATE TABLE IF NOT EXISTS commodities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  unit          text DEFAULT 'kg',
  category      text CHECK (category IN ('bumbu','pokok','protein')),
  is_sp2kp      boolean DEFAULT true,
  source_origin text DEFAULT 'sp2kp'
);

CREATE TABLE IF NOT EXISTS prices_raw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  city_raw      text NOT NULL,
  commodity_raw text NOT NULL,
  city_id       uuid REFERENCES cities(id),
  commodity_id  uuid REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  het_ha        numeric(12,2),
  source        text NOT NULL DEFAULT 'sp2kp',
  kode_wilayah  text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw, source)
);

CREATE INDEX IF NOT EXISTS idx_pr_date     ON prices_raw(date DESC);
CREATE INDEX IF NOT EXISTS idx_pr_source   ON prices_raw(source);
CREATE INDEX IF NOT EXISTS idx_pr_approved ON prices_raw(city_id, commodity_id, date DESC)
  WHERE city_id IS NOT NULL AND commodity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_city_null ON prices_raw(city_id) WHERE city_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pr_comm_null ON prices_raw(commodity_id) WHERE commodity_id IS NULL;


-- ═══════════════════════════════════════
-- 002 — Seed 17 komoditas SP2KP (idempotent)
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
  ('Tepung Terigu',                      'kg',    'pokok',   true)
ON CONFLICT (name) DO NOTHING;


-- ═══════════════════════════════════════
-- 003 — RPC get_sp2kp_latest(): SP2KP raw display layer
-- Group: (kode_wilayah, commodity_id). province/island/entity_type
-- di-derive dari kode_wilayah inline (no JOIN ke cities table).
-- cities table dipakai Phase 2 untuk cross-source canonicalization.
-- ═══════════════════════════════════════

-- DROP dulu karena return type berubah dari schema lama (city_id uuid →
-- kode_wilayah text). CREATE OR REPLACE tidak bisa ubah signature.
DROP FUNCTION IF EXISTS get_sp2kp_latest(text, text);

CREATE FUNCTION get_sp2kp_latest(
  p_island   text DEFAULT NULL,
  p_province text DEFAULT NULL
)
RETURNS TABLE(
  kode_wilayah   text,
  city_raw       text,
  province       text,
  island         text,
  entity_type    text,
  commodity_id   uuid,
  commodity_name text,
  category       text,
  unit           text,
  price_latest   numeric,
  price_prev     numeric,
  het_ha         numeric,
  date_latest    date,
  date_prev      date,
  avg_30d        numeric,
  max_30d        numeric,
  min_30d        numeric,
  obs_30d        bigint
) AS $$
  WITH ranked AS (
    SELECT
      pr.kode_wilayah, pr.city_raw, pr.commodity_id,
      pr.price, pr.het_ha, pr.date,
      ROW_NUMBER() OVER (
        PARTITION BY pr.kode_wilayah, pr.commodity_id
        ORDER BY pr.date DESC
      ) AS rn
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.kode_wilayah IS NOT NULL
      AND pr.commodity_id IS NOT NULL
  ),
  latest AS (SELECT * FROM ranked WHERE rn = 1),
  prev   AS (SELECT * FROM ranked WHERE rn = 2),
  stats  AS (
    SELECT
      pr.kode_wilayah, pr.commodity_id,
      AVG(pr.price)   AS avg_30d,
      MAX(pr.price)   AS max_30d,
      MIN(pr.price)   AS min_30d,
      COUNT(*)        AS obs_30d
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.kode_wilayah IS NOT NULL
      AND pr.commodity_id IS NOT NULL
      AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pr.kode_wilayah, pr.commodity_id
  )
  SELECT
    l.kode_wilayah,
    l.city_raw,
    CASE substr(l.kode_wilayah, 1, 2)
      WHEN '31' THEN 'DKI Jakarta'
      WHEN '32' THEN 'Jawa Barat'
      WHEN '33' THEN 'Jawa Tengah'
      WHEN '34' THEN 'DI Yogyakarta'
      WHEN '35' THEN 'Jawa Timur'
      WHEN '36' THEN 'Banten'
      WHEN '51' THEN 'Bali'
      WHEN '52' THEN 'Nusa Tenggara Barat'
      ELSE NULL
    END AS province,
    CASE
      WHEN l.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
      WHEN substr(l.kode_wilayah, 1, 2) = '51' THEN 'Bali'
      WHEN substr(l.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
      ELSE 'Jawa'
    END AS island,
    CASE WHEN l.city_raw ILIKE 'Kota%' THEN 'kota' ELSE 'kabupaten' END AS entity_type,
    cm.id, cm.name, cm.category, cm.unit,
    l.price, p.price, l.het_ha,
    l.date, p.date,
    s.avg_30d, s.max_30d, s.min_30d, COALESCE(s.obs_30d, 0)
  FROM latest l
  JOIN commodities cm ON cm.id = l.commodity_id
  LEFT JOIN prev   p  ON p.kode_wilayah = l.kode_wilayah AND p.commodity_id = l.commodity_id
  LEFT JOIN stats  s  ON s.kode_wilayah = l.kode_wilayah AND s.commodity_id = l.commodity_id
  WHERE
    (p_island IS NULL OR
      CASE
        WHEN l.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
        WHEN substr(l.kode_wilayah, 1, 2) = '51' THEN 'Bali'
        WHEN substr(l.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
        ELSE 'Jawa'
      END = p_island)
    AND (p_province IS NULL OR
      CASE substr(l.kode_wilayah, 1, 2)
        WHEN '31' THEN 'DKI Jakarta'
        WHEN '32' THEN 'Jawa Barat'
        WHEN '33' THEN 'Jawa Tengah'
        WHEN '34' THEN 'DI Yogyakarta'
        WHEN '35' THEN 'Jawa Timur'
        WHEN '36' THEN 'Banten'
        WHEN '51' THEN 'Bali'
        WHEN '52' THEN 'Nusa Tenggara Barat'
        ELSE NULL
      END = p_province);
$$ LANGUAGE SQL STABLE;


-- ═══════════════════════════════════════
-- 004 — auto_seed_cities(): derive cities dari prices_raw + backfill
-- Dipanggil dari /api/ingest/sp2kp setelah bulk insert.
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_seed_cities() RETURNS jsonb AS $$
DECLARE
  v_seeded     int := 0;
  v_backfilled int := 0;
BEGIN
  -- 1. INSERT cities baru (DISTINCT ON kode_wilayah, ambil city_raw terbaru)
  WITH new_cities AS (
    INSERT INTO cities (name, name_sp2kp, kode_wilayah, province, island, entity_type)
    SELECT DISTINCT ON (pr.kode_wilayah)
      pr.city_raw,
      pr.city_raw,
      pr.kode_wilayah,
      CASE substr(pr.kode_wilayah, 1, 2)
        WHEN '31' THEN 'DKI Jakarta'
        WHEN '32' THEN 'Jawa Barat'
        WHEN '33' THEN 'Jawa Tengah'
        WHEN '34' THEN 'DI Yogyakarta'
        WHEN '35' THEN 'Jawa Timur'
        WHEN '36' THEN 'Banten'
        WHEN '51' THEN 'Bali'
        WHEN '52' THEN 'Nusa Tenggara Barat'
      END,
      CASE
        WHEN pr.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
        WHEN substr(pr.kode_wilayah, 1, 2) = '51' THEN 'Bali'
        WHEN substr(pr.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
        ELSE 'Jawa'
      END,
      CASE
        WHEN pr.city_raw ILIKE 'Kota%' THEN 'kota'
        ELSE 'kabupaten'
      END
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.kode_wilayah IS NOT NULL
      AND pr.city_raw IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM cities c WHERE c.kode_wilayah = pr.kode_wilayah
      )
    ORDER BY pr.kode_wilayah, pr.created_at DESC
    ON CONFLICT (kode_wilayah) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_seeded FROM new_cities;

  -- 2. Backfill city_id pada prices_raw rows yang punya kode_wilayah cocok
  WITH updated AS (
    UPDATE prices_raw pr
    SET city_id = c.id
    FROM cities c
    WHERE pr.city_id IS NULL
      AND pr.kode_wilayah IS NOT NULL
      AND pr.kode_wilayah = c.kode_wilayah
    RETURNING pr.id
  )
  SELECT COUNT(*) INTO v_backfilled FROM updated;

  RETURN jsonb_build_object(
    'seeded',     v_seeded,
    'backfilled', v_backfilled
  );
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════
-- 005 — bulk_insert_sp2kp_prices(jsonb): batch insert RPC
-- Server kirim chunk JSONB (5000 rows × 4 concurrent).
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION bulk_insert_sp2kp_prices(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  WITH ins AS (
    INSERT INTO prices_raw (
      date, city_raw, commodity_raw, price, het_ha,
      source, kode_wilayah, commodity_id
    )
    SELECT
      (r->>'date')::date,
      r->>'city_raw',
      r->>'commodity_raw',
      (r->>'price')::numeric,
      CASE
        WHEN r->>'het_ha' IS NULL OR r->>'het_ha' = '' THEN NULL
        ELSE (r->>'het_ha')::numeric
      END,
      'sp2kp',
      r->>'kode_wilayah',
      CASE
        WHEN r->>'commodity_id' IS NULL OR r->>'commodity_id' = '' THEN NULL
        ELSE (r->>'commodity_id')::uuid
      END
    FROM jsonb_array_elements(p_rows) r
    ON CONFLICT (date, city_raw, commodity_raw, source) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════
-- 006 — Row Level Security policies
-- Public SELECT untuk cities/commodities/prices_raw approved.
-- INSERT/UPDATE/DELETE default deny → service_role bypass otomatis.
-- ═══════════════════════════════════════

ALTER TABLE cities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices_raw  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cities_public_read ON cities;
CREATE POLICY cities_public_read ON cities
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS commodities_public_read ON commodities;
CREATE POLICY commodities_public_read ON commodities
  FOR SELECT
  USING (true);

-- SP2KP raw display: tidak gating pada city_id (Phase 2 canonicalization).
DROP POLICY IF EXISTS prices_raw_public_read_approved ON prices_raw;
DROP POLICY IF EXISTS prices_raw_public_read_sp2kp ON prices_raw;
CREATE POLICY prices_raw_public_read_sp2kp ON prices_raw
  FOR SELECT
  USING (
    source = 'sp2kp'
    AND kode_wilayah IS NOT NULL
    AND commodity_id IS NOT NULL
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- ✓ Setup selesai. Verifikasi cepat:
--
--   SELECT count(*) FROM commodities WHERE is_sp2kp = true;       -- harus 17
--   SELECT count(*) FROM cities;                                    -- 0 sampai upload pertama
--   SELECT count(*) FROM prices_raw;                                -- 0 sampai upload pertama
--
-- Test RPC tersedia:
--   SELECT * FROM get_sp2kp_latest() LIMIT 1;                       -- empty result OK
--   SELECT auto_seed_cities();                                       -- {"seeded": 0, "backfilled": 0}
--   SELECT bulk_insert_sp2kp_prices('[]'::jsonb);                    -- {"inserted": 0}
-- ═══════════════════════════════════════════════════════════════════════════
