-- ═══════════════════════════════════════
-- 026 — PIHPS Scraper: scrape_runs + get_pihps_latest RPC
--
-- PIHPS data sumber Bank Indonesia (bi.go.id/hargapangan).
-- Scraper menulis langsung ke prices_raw dengan source='pihps'.
-- RPC mengembalikan shape sama dengan get_sp2kp_latest agar UI bisa reuse
-- semua komponen SP2KP (CityRow, CommodityGroupRow, ChartPanel, dll).
--
-- Mapping strategy:
--   - kode_wilayah: ILIKE join ke cities table; jika tidak match, pakai
--     city_raw sendiri sebagai surrogate key (chart query memakai ini).
--   - commodity_id: ILIKE join ke commodities table; null jika tidak match.
--   - province / island: dari cities lookup, fallback derive dari city_raw.
--   - HET tidak ada di PIHPS (BI tidak publish HET) → het_ha = NULL.
-- ═══════════════════════════════════════

-- 1. scrape_runs: logging tiap eksekusi scraper
CREATE TABLE IF NOT EXISTS scrape_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  rows_scraped    int NOT NULL DEFAULT 0,
  rows_inserted   int NOT NULL DEFAULT 0,
  rows_updated    int NOT NULL DEFAULT 0,
  rows_skipped    int NOT NULL DEFAULT 0,
  duration_ms     int,
  error_message   text,
  metadata        jsonb
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_source_started
  ON scrape_runs (source, started_at DESC);

ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_scrape_runs" ON scrape_runs;
CREATE POLICY "anon_read_scrape_runs"
  ON scrape_runs FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_write_scrape_runs" ON scrape_runs;
CREATE POLICY "service_write_scrape_runs"
  ON scrape_runs FOR ALL USING (true) WITH CHECK (true);

-- 2. get_pihps_latest RPC — same shape as get_sp2kp_latest
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
    FROM prices_raw pr
    WHERE pr.source = 'pihps'
      AND pr.date <= CURRENT_DATE
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
    FROM prices_raw pr
    WHERE pr.source = 'pihps'
      AND pr.date <= CURRENT_DATE
      AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pr.city_raw, pr.commodity_raw
  ),
  -- Lookup cities by name (case-insensitive). PIHPS may use names like
  -- "JAKARTA" or "BANDUNG" while cities table has "Kota Jakarta Pusat".
  -- Use ILIKE substring match; first match wins via DISTINCT ON.
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
    -- Use city_raw as surrogate kode_wilayah when no match (chart filters by city_raw for PIHPS)
    COALESCE(cl.kode_wilayah, l.city_raw)        AS kode_wilayah,
    COALESCE(cl.city_canonical, l.city_raw)      AS city_raw,
    COALESCE(cl.province, '—')                   AS province,
    COALESCE(cl.island, 'Lainnya')               AS island,
    cl.entity_type,
    coml.commodity_id,
    COALESCE(coml.commodity_canonical, l.commodity_raw) AS commodity_name,
    coml.category,
    COALESCE(coml.unit, 'kg')                    AS unit,
    l.price                                      AS price_latest,
    p.price                                      AS price_prev,
    NULL::numeric                                AS het_ha,
    l.date                                       AS date_latest,
    p.date                                       AS date_prev,
    s.avg_30d, s.max_30d, s.min_30d, COALESCE(s.obs_30d, 0)
  FROM latest l
  LEFT JOIN prev p ON p.city_raw = l.city_raw AND p.commodity_raw = l.commodity_raw
  LEFT JOIN stats s ON s.city_raw = l.city_raw AND s.commodity_raw = l.commodity_raw
  LEFT JOIN city_lookup cl ON cl.city_raw = l.city_raw
  LEFT JOIN commodity_lookup coml ON coml.commodity_raw = l.commodity_raw
  WHERE
    (p_island IS NULL OR COALESCE(cl.island, 'Lainnya') = p_island)
    AND (p_province IS NULL OR COALESCE(cl.province, '—') = p_province);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
