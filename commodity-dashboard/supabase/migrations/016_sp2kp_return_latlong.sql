-- ═══════════════════════════════════════
-- 016 — get_sp2kp_latest: return latitude & longitude from cities table
--
-- Dibutuhkan oleh arbitrage engine untuk menghitung jarak aktual (Haversine)
-- antar kota sebagai pengganti fallback 200km flat.
-- Re-runnable. Mempertahankan SECURITY DEFINER dari migration 009.
-- ═══════════════════════════════════════

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
  latitude       numeric,
  longitude      numeric
) AS $$
  WITH ranked AS (
    SELECT
      pr.kode_wilayah, pr.commodity_id,
      pr.price, pr.het_ha, pr.date,
      ROW_NUMBER() OVER (
        PARTITION BY pr.kode_wilayah, pr.commodity_id
        ORDER BY pr.date DESC
      ) AS rn
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.kode_wilayah IS NOT NULL
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
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.kode_wilayah IS NOT NULL
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
      c.latitude,
      c.longitude
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
    sc.latitude,
    sc.longitude
  FROM scope_cities sc
  CROSS JOIN (SELECT * FROM commodities WHERE is_sp2kp = true) cm
  LEFT JOIN latest l ON l.kode_wilayah = sc.kode_wilayah AND l.commodity_id = cm.id
  LEFT JOIN prev   p ON p.kode_wilayah  = sc.kode_wilayah AND p.commodity_id  = cm.id
  LEFT JOIN stats  s ON s.kode_wilayah  = sc.kode_wilayah AND s.commodity_id  = cm.id
  WHERE
    (p_island IS NULL OR sc.island = p_island)
    AND (p_province IS NULL OR sc.province = p_province);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
