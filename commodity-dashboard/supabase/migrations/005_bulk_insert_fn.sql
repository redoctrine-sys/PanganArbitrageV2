-- ═══════════════════════════════════════
-- 005 — bulk_insert_sp2kp_prices(jsonb): single RPC untuk batch insert
-- Server kirim array JSONB (max ~5000 rows/chunk) → satu round-trip per chunk.
-- INSERT ... SELECT FROM jsonb_array_elements + ON CONFLICT DO NOTHING.
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
