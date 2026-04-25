-- ═══════════════════════════════════════
-- 004 — Auto-seed cities from prices_raw + backfill city_id
-- Phase 1 deploy: SP2KP file punya kode_wilayah BPS yang reliable, jadi
-- cities bisa di-derive otomatis tanpa naming agent. Setelah ingest,
-- API route memanggil SELECT auto_seed_cities() untuk:
--   1. INSERT city baru (kode_wilayah belum ada di cities)
--   2. UPDATE prices_raw.city_id NULL → c.id berdasarkan match kode_wilayah
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
