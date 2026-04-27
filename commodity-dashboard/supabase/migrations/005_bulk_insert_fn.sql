-- ═══════════════════════════════════════
-- 005 — bulk_insert_sp2kp_prices(jsonb): conditional upsert RPC
-- Server kirim array JSONB (max ~5000 rows/chunk) → satu round-trip per chunk.
--
-- Behavior:
--   • Row baru (date, city_raw, commodity_raw, source) belum ada → INSERT
--   • Row ada, price/het_ha BERUBAH → UPDATE
--   • Row ada, price/het_ha SAMA → SKIP (tidak ditulis ulang)
--
-- Trik xmax = 0 di RETURNING membedakan baris INSERT (xmax = 0) vs UPDATE
-- (xmax = txid berjalan). Baris yang gagal lolos WHERE conditional update
-- tidak ikut RETURNING — itu yang dihitung sebagai "unchanged".
--
-- Metadata (commodity_id, kode_wilayah) ikut di-update bila berubah.
-- Ini handle kasus backfill: ingest pertama mungkin commodity_id NULL
-- (karena seed belum lengkap), ingest kedua resolve → row di-update.
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION bulk_insert_sp2kp_prices(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  v_total    int := 0;
  v_inserted int := 0;
  v_updated  int := 0;
BEGIN
  v_total := jsonb_array_length(p_rows);

  WITH upserted AS (
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
    ON CONFLICT (date, city_raw, commodity_raw, source) DO UPDATE SET
      price        = EXCLUDED.price,
      het_ha       = EXCLUDED.het_ha,
      commodity_id = EXCLUDED.commodity_id,
      kode_wilayah = EXCLUDED.kode_wilayah
    WHERE
      prices_raw.price        IS DISTINCT FROM EXCLUDED.price
      OR prices_raw.het_ha    IS DISTINCT FROM EXCLUDED.het_ha
      OR prices_raw.commodity_id IS DISTINCT FROM EXCLUDED.commodity_id
      OR prices_raw.kode_wilayah IS DISTINCT FROM EXCLUDED.kode_wilayah
    RETURNING (xmax = 0) AS is_insert
  )
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE is_insert), 0),
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
