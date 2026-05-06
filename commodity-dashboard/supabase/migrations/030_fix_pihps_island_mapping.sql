-- 030 — Fix PIHPS island mapping: provinces no longer fall into 'Jawa'
--
-- Root cause: city_lookup CASE for island had ELSE 'Jawa', so any city not
-- matched in the cities table (province-level aggregates like "Aceh",
-- "Gorontalo", "Maluku", etc.) was incorrectly placed in the "Jawa" tab.
--
-- Fixes applied to get_pihps_latest:
--   1. island: strict — kode_wilayah IS NULL → 'Lainnya'; explicit Jawa
--      check on prefix IN (31-36); ELSE 'Lainnya' (not 'Jawa').
--   2. entity_type: kode_wilayah IS NULL → 'provinsi' (was 'kabupaten').
--   3. province: COALESCE(case_expr, l.city_raw) — unmatched cities use
--      their own city_raw as province fallback ("Aceh" → province="Aceh").

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
      -- Province: known kode_wilayah prefixes; fallback to city_raw itself
      -- so province-level aggregates ("Aceh") get province = "Aceh".
      COALESCE(
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
        END,
        l.city_raw
      ) AS province,
      -- Island: strict — unmatched cities → 'Lainnya', not default 'Jawa'.
      CASE
        WHEN c.kode_wilayah IS NULL                                    THEN 'Lainnya'
        WHEN c.kode_wilayah IN ('3526','3527','3528','3529')           THEN 'Madura'
        WHEN substr(c.kode_wilayah, 1, 2) = '51'                      THEN 'Bali'
        WHEN substr(c.kode_wilayah, 1, 2) = '52'                      THEN 'Lombok'
        WHEN substr(c.kode_wilayah, 1, 2) IN ('31','32','33','34','35','36') THEN 'Jawa'
        ELSE 'Lainnya'
      END AS island,
      -- entity_type: unmatched city → province-level aggregate.
      CASE
        WHEN c.kode_wilayah IS NULL  THEN 'provinsi'
        WHEN c.name ILIKE 'Kota%'   THEN 'kota'
        ELSE 'kabupaten'
      END AS entity_type
    FROM (SELECT DISTINCT city_raw FROM latest) l
    LEFT JOIN cities c ON lower(c.name) = lower(l.city_raw)
    ORDER BY l.city_raw, c.kode_wilayah NULLS LAST
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
      ON lower(l.commodity_raw) LIKE lower(cm.name) || '%'
      OR lower(cm.name) = lower(l.commodity_raw)
    ORDER BY l.commodity_raw, length(cm.name) DESC
  )
  SELECT
    COALESCE(cl.kode_wilayah, l.city_raw)               AS kode_wilayah,
    COALESCE(cl.city_canonical, l.city_raw)             AS city_raw,
    COALESCE(cl.province, l.city_raw)                   AS province,
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
  LEFT JOIN prev             p    ON p.city_raw      = l.city_raw      AND p.commodity_raw      = l.commodity_raw
  LEFT JOIN stats            s    ON s.city_raw      = l.city_raw      AND s.commodity_raw      = l.commodity_raw
  LEFT JOIN city_lookup      cl   ON cl.city_raw     = l.city_raw
  LEFT JOIN commodity_lookup coml ON coml.commodity_raw = l.commodity_raw
  WHERE
    (p_island   IS NULL OR COALESCE(cl.island,   'Lainnya') = p_island)
    AND (p_province IS NULL OR COALESCE(cl.province, l.city_raw) = p_province);
$$ LANGUAGE SQL STABLE;
-- No SECURITY DEFINER — keeps SQL function inlining active (500x perf gain from 028).

NOTIFY pgrst, 'reload schema';
