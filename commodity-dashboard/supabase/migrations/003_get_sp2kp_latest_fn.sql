-- ═══════════════════════════════════════
-- 003 — RPC get_sp2kp_latest()
-- Phase 1: SP2KP raw display — data ditampilkan apa adanya, tanpa gating
-- "approved" via cities table. Group key = (kode_wilayah, commodity_id).
-- province/island/entity_type di-derive dari kode_wilayah + city_raw inline.
--
-- cities table TIDAK di-JOIN di sini — itu untuk Phase 2 cross-source
-- canonicalization (Komparasi tab). auto_seed_cities() tetap dipanggil saat
-- ingest untuk pre-seed Phase 2, tapi tidak blocking display Phase 1.
-- ═══════════════════════════════════════

-- DROP dulu karena return type berubah (city_id uuid → kode_wilayah text,
-- city_name → city_raw). CREATE OR REPLACE tidak boleh ubah signature.
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
    -- Province dari prefix 2-digit kode_wilayah (BPS standard)
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
    -- Island: Madura override (3526-3529 = Madura island, prov tetap Jatim);
    -- 51 → Bali; 52 → Lombok; selain itu prefix 31-36 → Jawa
    CASE
      WHEN l.kode_wilayah IN ('3526','3527','3528','3529') THEN 'Madura'
      WHEN substr(l.kode_wilayah, 1, 2) = '51' THEN 'Bali'
      WHEN substr(l.kode_wilayah, 1, 2) = '52' THEN 'Lombok'
      ELSE 'Jawa'
    END AS island,
    -- entity_type: prefix nama "Kota" → kota, selain itu kabupaten
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
