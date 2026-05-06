-- ════════════════════════════════════════════════════════════════════════════
-- 028 — Fix get_pihps_latest performance (statement timeout)
--
-- Root cause:
--   1. city_lookup and commodity_lookup used double-sided ILIKE '%...%' joins,
--      forcing a full Cartesian scan (all city_raw × all cities rows).
--   2. pihps_raw lacked a composite index covering the PARTITION BY columns
--      used by the ranked CTE window function.
--   3. SECURITY DEFINER prevented the SQL function from being inlined by the
--      optimizer. Without inlining, PostgreSQL used nested-loop joins that
--      re-evaluated the ranked CTE per row → O(n²) → ~8.8 s for 3531 rows.
--      Removing SECURITY DEFINER allows inlining → hash joins → 17 ms.
--      (pihps_raw RLS policy USING(true) lets anon read without elevated role.)
--
-- Fixes:
--   1. Add composite index (city_raw, commodity_raw, date DESC) — covers
--      ROW_NUMBER() OVER (PARTITION BY city_raw, commodity_raw ORDER BY date DESC)
--      and the stats GROUP BY.
--   2. Add functional index lower(name) on cities for case-insensitive exact join.
--   3. Replace double-sided ILIKE '%a%' OR '%b%' with one-sided matches:
--      city    : lower(c.name) = lower(l.city_raw)       (exact, index-able)
--      commodity: lower(l.commodity_raw) LIKE lower(cm.name) || '%'
--                 (starts-with — "Beras Kualitas Bawah I" matches master "Beras")
--   4. Remove SECURITY DEFINER → enables SQL function inlining → 500x speedup.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Composite index for window function performance ───────────────────────
CREATE INDEX IF NOT EXISTS idx_pihps_raw_perf
  ON pihps_raw(city_raw, commodity_raw, date DESC);

-- ─── 2. Functional index on cities.name for fast exact ILIKE join ─────────────
CREATE INDEX IF NOT EXISTS idx_cities_name_lower
  ON cities(lower(name));

-- ─── 3. Optimized get_pihps_latest ───────────────────────────────────────────

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
    -- idx_pihps_raw_perf covers PARTITION BY + ORDER BY — no seq scan
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
  -- Exact case-insensitive match on city name — avoids Cartesian ILIKE scan.
  -- DISTINCT ON (l.city_raw) picks one match when multiple cities share a name.
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
    LEFT JOIN cities c ON lower(c.name) = lower(l.city_raw)
    ORDER BY l.city_raw, c.kode_wilayah NULLS LAST
  ),
  -- Starts-with match: "Beras Kualitas Bawah I" matches master "Beras".
  -- Faster than double-sided wildcard; still handles PIHPS verbose names.
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
    ORDER BY l.commodity_raw, length(cm.name) DESC  -- prefer longest/most-specific match
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
  LEFT JOIN prev             p    ON p.city_raw      = l.city_raw      AND p.commodity_raw      = l.commodity_raw
  LEFT JOIN stats            s    ON s.city_raw      = l.city_raw      AND s.commodity_raw      = l.commodity_raw
  LEFT JOIN city_lookup      cl   ON cl.city_raw     = l.city_raw
  LEFT JOIN commodity_lookup coml ON coml.commodity_raw = l.commodity_raw
  WHERE
    (p_island   IS NULL OR COALESCE(cl.island,   'Lainnya') = p_island)
    AND (p_province IS NULL OR COALESCE(cl.province, '—')       = p_province);
$$ LANGUAGE SQL STABLE;
-- No SECURITY DEFINER: allows optimizer to inline this function → 500x faster.

NOTIFY pgrst, 'reload schema';
