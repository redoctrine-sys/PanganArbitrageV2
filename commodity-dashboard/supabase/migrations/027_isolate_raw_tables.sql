-- ═══════════════════════════════════════════════════════════════════════════
-- 027 — Medallion Architecture: Isolate raw tables per source (Bronze layer)
--
-- Tujuan: pisahkan prices_raw (single-table multi-source) menjadi tabel
-- terisolasi per sumber agar metadata unik tiap sumber bisa disimpan dengan
-- benar dan mutasi satu sumber tidak bisa merusak data sumber lain.
--
-- Bronze: pihps_raw, sp2kp_raw, facebook_raw, paskomnas_raw
-- Silver: v_prices_comparison (UNION ALL aggregator untuk komparasi dashboard)
--
-- Data existing di prices_raw dimigrasikan ke tabel baru.
-- prices_raw dipertahankan (tidak di-drop) untuk backward compat; tidak ada
-- write baru setelah migrasi ini.
--
-- RPCs yang diupdate:
--   bulk_insert_sp2kp_prices → INSERT INTO sp2kp_raw
--   get_sp2kp_latest          → FROM sp2kp_raw
--   get_pihps_latest          → FROM pihps_raw
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. pihps_raw ────────────────────────────────────────────────────────────
-- market_type: "Pasar Tradisional" | "Pasar Modern" | "Pedagang Besar" | "Produsen"
-- UNIQUE includes market_type — 4 separate rows per (date, city, commodity).

CREATE TABLE IF NOT EXISTS pihps_raw (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date         NOT NULL,
  city_raw      text         NOT NULL,
  commodity_raw text         NOT NULL,
  city_id       uuid         REFERENCES cities(id),
  commodity_id  uuid         REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  market_type   text         NOT NULL DEFAULT '',
  kode_wilayah  text,
  created_at    timestamptz  DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw, market_type)
);

CREATE INDEX IF NOT EXISTS idx_pihps_raw_date
  ON pihps_raw(date DESC);
CREATE INDEX IF NOT EXISTS idx_pihps_raw_city_com
  ON pihps_raw(city_raw, commodity_raw);
CREATE INDEX IF NOT EXISTS idx_pihps_raw_resolved
  ON pihps_raw(city_id, commodity_id, date DESC)
  WHERE city_id IS NOT NULL AND commodity_id IS NOT NULL;

ALTER TABLE pihps_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_pihps_raw"    ON pihps_raw;
DROP POLICY IF EXISTS "service_write_pihps_raw" ON pihps_raw;
CREATE POLICY "anon_read_pihps_raw"
  ON pihps_raw FOR SELECT USING (true);
CREATE POLICY "service_write_pihps_raw"
  ON pihps_raw FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. sp2kp_raw ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sp2kp_raw (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date         NOT NULL,
  city_raw      text         NOT NULL,
  commodity_raw text         NOT NULL,
  city_id       uuid         REFERENCES cities(id),
  commodity_id  uuid         REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  het_ha        numeric(12,2),
  kode_wilayah  text,
  created_at    timestamptz  DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw)
);

CREATE INDEX IF NOT EXISTS idx_sp2kp_raw_date
  ON sp2kp_raw(date DESC);
CREATE INDEX IF NOT EXISTS idx_sp2kp_raw_resolved
  ON sp2kp_raw(kode_wilayah, commodity_id, date DESC)
  WHERE kode_wilayah IS NOT NULL AND commodity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sp2kp_raw_null_city
  ON sp2kp_raw(city_id) WHERE city_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sp2kp_raw_null_comm
  ON sp2kp_raw(commodity_id) WHERE commodity_id IS NULL;

ALTER TABLE sp2kp_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_sp2kp_raw"    ON sp2kp_raw;
DROP POLICY IF EXISTS "service_write_sp2kp_raw" ON sp2kp_raw;
CREATE POLICY "anon_read_sp2kp_raw"
  ON sp2kp_raw FOR SELECT USING (true);
CREATE POLICY "service_write_sp2kp_raw"
  ON sp2kp_raw FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. facebook_raw ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facebook_raw (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date         NOT NULL,
  city_raw      text         NOT NULL,
  commodity_raw text         NOT NULL,
  city_id       uuid         REFERENCES cities(id),
  commodity_id  uuid         REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  confidence    numeric(3,2),
  source_url    text,
  post_snippet  text,
  created_at    timestamptz  DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw)
);

CREATE INDEX IF NOT EXISTS idx_facebook_raw_date ON facebook_raw(date DESC);

ALTER TABLE facebook_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_facebook_raw"    ON facebook_raw;
DROP POLICY IF EXISTS "service_write_facebook_raw" ON facebook_raw;
CREATE POLICY "anon_read_facebook_raw"
  ON facebook_raw FOR SELECT USING (true);
CREATE POLICY "service_write_facebook_raw"
  ON facebook_raw FOR ALL USING (true) WITH CHECK (true);

-- ─── 4. paskomnas_raw ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS paskomnas_raw (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date         NOT NULL,
  city_raw      text         NOT NULL,
  commodity_raw text         NOT NULL,
  city_id       uuid         REFERENCES cities(id),
  commodity_id  uuid         REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  market_name   text,
  kode_wilayah  text,
  created_at    timestamptz  DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw)
);

CREATE INDEX IF NOT EXISTS idx_paskomnas_raw_date ON paskomnas_raw(date DESC);

ALTER TABLE paskomnas_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_paskomnas_raw"    ON paskomnas_raw;
DROP POLICY IF EXISTS "service_write_paskomnas_raw" ON paskomnas_raw;
CREATE POLICY "anon_read_paskomnas_raw"
  ON paskomnas_raw FOR SELECT USING (true);
CREATE POLICY "service_write_paskomnas_raw"
  ON paskomnas_raw FOR ALL USING (true) WITH CHECK (true);

-- ─── 5. Migrate existing data from prices_raw ────────────────────────────────
-- ON CONFLICT DO NOTHING — safe to re-run.
-- PIHPS migrated with market_type='' (old schema had no market_type column).

INSERT INTO pihps_raw (id, date, city_raw, commodity_raw, city_id, commodity_id,
                       price, market_type, kode_wilayah, created_at)
SELECT id, date, city_raw, commodity_raw, city_id, commodity_id,
       price, '', kode_wilayah, created_at
FROM prices_raw
WHERE source = 'pihps'
ON CONFLICT DO NOTHING;

INSERT INTO sp2kp_raw (id, date, city_raw, commodity_raw, city_id, commodity_id,
                       price, het_ha, kode_wilayah, created_at)
SELECT id, date, city_raw, commodity_raw, city_id, commodity_id,
       price, het_ha, kode_wilayah, created_at
FROM prices_raw
WHERE source = 'sp2kp'
ON CONFLICT DO NOTHING;

INSERT INTO facebook_raw (id, date, city_raw, commodity_raw, city_id, commodity_id,
                          price, created_at)
SELECT id, date, city_raw, commodity_raw, city_id, commodity_id,
       price, created_at
FROM prices_raw
WHERE source = 'facebook'
ON CONFLICT DO NOTHING;

INSERT INTO paskomnas_raw (id, date, city_raw, commodity_raw, city_id, commodity_id,
                           price, created_at)
SELECT id, date, city_raw, commodity_raw, city_id, commodity_id,
       price, created_at
FROM prices_raw
WHERE source = 'paskomnas'
ON CONFLICT DO NOTHING;

-- ─── 6. Aggregator View: v_prices_comparison (Silver/Gold layer) ─────────────

CREATE OR REPLACE VIEW v_prices_comparison AS
  SELECT
    id, date, city_raw, commodity_raw, city_id, commodity_id, price,
    'pihps'::text   AS source,
    market_type     AS context,
    kode_wilayah,
    NULL::numeric   AS het_ha
  FROM pihps_raw
  UNION ALL
  SELECT
    id, date, city_raw, commodity_raw, city_id, commodity_id, price,
    'sp2kp'::text   AS source,
    NULL            AS context,
    kode_wilayah,
    het_ha
  FROM sp2kp_raw
  UNION ALL
  SELECT
    id, date, city_raw, commodity_raw, city_id, commodity_id, price,
    'facebook'::text  AS source,
    confidence::text  AS context,
    NULL              AS kode_wilayah,
    NULL::numeric     AS het_ha
  FROM facebook_raw
  UNION ALL
  SELECT
    id, date, city_raw, commodity_raw, city_id, commodity_id, price,
    'paskomnas'::text AS source,
    market_name       AS context,
    kode_wilayah,
    NULL::numeric     AS het_ha
  FROM paskomnas_raw;

-- ─── 7. Update bulk_insert_sp2kp_prices → writes to sp2kp_raw ────────────────

CREATE OR REPLACE FUNCTION bulk_insert_sp2kp_prices(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  v_total    int := 0;
  v_inserted int := 0;
  v_updated  int := 0;
BEGIN
  v_total := jsonb_array_length(p_rows);

  WITH upserted AS (
    INSERT INTO sp2kp_raw (
      date, city_raw, commodity_raw, price, het_ha,
      kode_wilayah, commodity_id
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
      r->>'kode_wilayah',
      CASE
        WHEN r->>'commodity_id' IS NULL OR r->>'commodity_id' = '' THEN NULL
        ELSE (r->>'commodity_id')::uuid
      END
    FROM jsonb_array_elements(p_rows) r
    ON CONFLICT (date, city_raw, commodity_raw) DO UPDATE SET
      price        = EXCLUDED.price,
      het_ha       = EXCLUDED.het_ha,
      commodity_id = EXCLUDED.commodity_id,
      kode_wilayah = EXCLUDED.kode_wilayah
    WHERE
      sp2kp_raw.price           IS DISTINCT FROM EXCLUDED.price
      OR sp2kp_raw.het_ha       IS DISTINCT FROM EXCLUDED.het_ha
      OR sp2kp_raw.commodity_id IS DISTINCT FROM EXCLUDED.commodity_id
      OR sp2kp_raw.kode_wilayah IS DISTINCT FROM EXCLUDED.kode_wilayah
    RETURNING (xmax = 0) AS is_insert
  )
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE is_insert),     0),
    COALESCE(COUNT(*) FILTER (WHERE NOT is_insert), 0)
  INTO v_inserted, v_updated
  FROM upserted;

  RETURN jsonb_build_object(
    'inserted',  v_inserted,
    'updated',   v_updated,
    'unchanged', v_total - v_inserted - v_updated
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 8. Update get_sp2kp_latest → reads from sp2kp_raw ──────────────────────

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
  obs_30d        bigint,
  lat            numeric,
  lng            numeric
) AS $$
  WITH ranked AS (
    SELECT
      pr.kode_wilayah, pr.commodity_id,
      pr.price, pr.het_ha, pr.date,
      ROW_NUMBER() OVER (
        PARTITION BY pr.kode_wilayah, pr.commodity_id
        ORDER BY pr.date DESC
      ) AS rn
    FROM sp2kp_raw pr
    WHERE pr.kode_wilayah IS NOT NULL
      AND pr.commodity_id IS NOT NULL
      AND pr.date <= CURRENT_DATE
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
    FROM sp2kp_raw pr
    WHERE pr.kode_wilayah IS NOT NULL
      AND pr.commodity_id IS NOT NULL
      AND pr.date <= CURRENT_DATE
      AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pr.kode_wilayah, pr.commodity_id
  ),
  scope_cities AS (
    SELECT
      c.kode_wilayah,
      c.name AS city_raw,
      CASE substr(c.kode_wilayah, 1, 2)
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
        WHEN c.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
        WHEN substr(c.kode_wilayah, 1, 2) = '51' THEN 'Bali'
        WHEN substr(c.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
        ELSE 'Jawa'
      END AS island,
      CASE WHEN c.name ILIKE 'Kota%' THEN 'kota' ELSE 'kabupaten' END AS entity_type,
      c.lat,
      c.lng
    FROM cities c
    WHERE c.kode_wilayah IS NOT NULL
      AND substr(c.kode_wilayah, 1, 2) IN ('31','32','33','34','35','36','51','52')
  )
  SELECT
    sc.kode_wilayah,
    sc.city_raw,
    sc.province,
    sc.island,
    sc.entity_type,
    cm.id, cm.name, cm.category, cm.unit,
    l.price, p.price, l.het_ha,
    l.date, p.date,
    s.avg_30d, s.max_30d, s.min_30d, COALESCE(s.obs_30d, 0),
    sc.lat,
    sc.lng
  FROM scope_cities sc
  CROSS JOIN (SELECT * FROM commodities WHERE is_sp2kp = true) cm
  LEFT JOIN latest l ON l.kode_wilayah = sc.kode_wilayah AND l.commodity_id = cm.id
  LEFT JOIN prev   p ON p.kode_wilayah  = sc.kode_wilayah AND p.commodity_id  = cm.id
  LEFT JOIN stats  s ON s.kode_wilayah  = sc.kode_wilayah AND s.commodity_id  = cm.id
  WHERE
    (p_island IS NULL OR sc.island = p_island)
    AND (p_province IS NULL OR sc.province = p_province);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── 9. Update get_pihps_latest → reads from pihps_raw ──────────────────────

DROP FUNCTION IF EXISTS get_pihps_latest(text, text);

CREATE FUNCTION get_pihps_latest(
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
      pr.city_raw, pr.commodity_raw,
      pr.price, pr.date,
      ROW_NUMBER() OVER (
        PARTITION BY pr.city_raw, pr.commodity_raw
        ORDER BY pr.date DESC
      ) AS rn
    FROM pihps_raw pr
    WHERE pr.date <= CURRENT_DATE
  ),
  latest AS (SELECT * FROM ranked WHERE rn = 1),
  prev   AS (SELECT * FROM ranked WHERE rn = 2),
  stats  AS (
    SELECT
      pr.city_raw, pr.commodity_raw,
      AVG(pr.price) AS avg_30d,
      MAX(pr.price) AS max_30d,
      MIN(pr.price) AS min_30d,
      COUNT(*)      AS obs_30d
    FROM pihps_raw pr
    WHERE pr.date <= CURRENT_DATE
      AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pr.city_raw, pr.commodity_raw
  ),
  city_lookup AS (
    SELECT DISTINCT ON (l.city_raw)
      l.city_raw,
      c.kode_wilayah,
      c.name AS city_canonical,
      CASE substr(c.kode_wilayah, 1, 2)
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
        WHEN c.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
        WHEN substr(c.kode_wilayah, 1, 2) = '51' THEN 'Bali'
        WHEN substr(c.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
        ELSE 'Jawa'
      END AS island,
      CASE WHEN c.name ILIKE 'Kota%' THEN 'kota' ELSE 'kabupaten' END AS entity_type
    FROM (SELECT DISTINCT city_raw FROM latest) l
    LEFT JOIN cities c
      ON c.name ILIKE '%' || l.city_raw || '%'
      OR l.city_raw ILIKE '%' || c.name || '%'
  ),
  commodity_lookup AS (
    SELECT DISTINCT ON (l.commodity_raw)
      l.commodity_raw,
      cm.id AS commodity_id,
      cm.name AS commodity_canonical,
      cm.category,
      cm.unit
    FROM (SELECT DISTINCT commodity_raw FROM latest) l
    LEFT JOIN commodities cm
      ON cm.name ILIKE '%' || l.commodity_raw || '%'
      OR l.commodity_raw ILIKE '%' || cm.name || '%'
  )
  SELECT
    COALESCE(cl.kode_wilayah, l.city_raw)               AS kode_wilayah,
    COALESCE(cl.city_canonical, l.city_raw)             AS city_raw,
    COALESCE(cl.province, '—')                          AS province,
    COALESCE(cl.island, 'Lainnya')                      AS island,
    cl.entity_type,
    coml.commodity_id,
    COALESCE(coml.commodity_canonical, l.commodity_raw) AS commodity_name,
    coml.category,
    COALESCE(coml.unit, 'kg')                           AS unit,
    l.price                                             AS price_latest,
    p.price                                             AS price_prev,
    NULL::numeric                                       AS het_ha,
    l.date                                              AS date_latest,
    p.date                                              AS date_prev,
    s.avg_30d, s.max_30d, s.min_30d, COALESCE(s.obs_30d, 0)
  FROM latest l
  LEFT JOIN prev           p    ON p.city_raw    = l.city_raw    AND p.commodity_raw    = l.commodity_raw
  LEFT JOIN stats          s    ON s.city_raw    = l.city_raw    AND s.commodity_raw    = l.commodity_raw
  LEFT JOIN city_lookup    cl   ON cl.city_raw   = l.city_raw
  LEFT JOIN commodity_lookup coml ON coml.commodity_raw = l.commodity_raw
  WHERE
    (p_island   IS NULL OR COALESCE(cl.island,   'Lainnya') = p_island)
    AND (p_province IS NULL OR COALESCE(cl.province, '—')       = p_province);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
