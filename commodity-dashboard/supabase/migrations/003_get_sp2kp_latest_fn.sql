-- ═══════════════════════════════════════
-- 003 — RPC get_sp2kp_latest()
-- Output: 1 row per (city, commodity) approved, dengan harga terbaru,
-- harga sebelumnya untuk Δ%, dan stats 30-hari untuk volatilitas/vs avg.
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION get_sp2kp_latest(
  p_island   text DEFAULT NULL,
  p_province text DEFAULT NULL
)
RETURNS TABLE(
  city_id        uuid,
  city_name      text,
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
      pr.city_id, pr.commodity_id, pr.price, pr.het_ha, pr.date,
      ROW_NUMBER() OVER (
        PARTITION BY pr.city_id, pr.commodity_id
        ORDER BY pr.date DESC
      ) AS rn
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.city_id IS NOT NULL
      AND pr.commodity_id IS NOT NULL
  ),
  latest AS (SELECT * FROM ranked WHERE rn = 1),
  prev   AS (SELECT * FROM ranked WHERE rn = 2),
  stats  AS (
    SELECT
      pr.city_id, pr.commodity_id,
      AVG(pr.price)   AS avg_30d,
      MAX(pr.price)   AS max_30d,
      MIN(pr.price)   AS min_30d,
      COUNT(*)        AS obs_30d
    FROM prices_raw pr
    WHERE pr.source = 'sp2kp'
      AND pr.city_id IS NOT NULL
      AND pr.commodity_id IS NOT NULL
      AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pr.city_id, pr.commodity_id
  )
  SELECT
    c.id,  c.name, c.province, c.island, c.entity_type,
    cm.id, cm.name, cm.category, cm.unit,
    l.price, p.price, l.het_ha,
    l.date, p.date,
    s.avg_30d, s.max_30d, s.min_30d, COALESCE(s.obs_30d, 0)
  FROM latest l
  JOIN cities      c  ON c.id  = l.city_id
  JOIN commodities cm ON cm.id = l.commodity_id
  LEFT JOIN prev   p  ON p.city_id = l.city_id AND p.commodity_id = l.commodity_id
  LEFT JOIN stats  s  ON s.city_id = l.city_id AND s.commodity_id = l.commodity_id
  WHERE (p_island   IS NULL OR c.island   = p_island)
    AND (p_province IS NULL OR c.province = p_province);
$$ LANGUAGE SQL STABLE;
