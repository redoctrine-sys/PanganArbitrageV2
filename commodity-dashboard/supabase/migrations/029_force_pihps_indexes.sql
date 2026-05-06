-- 029 — Force-ensure PIHPS performance indexes exist
-- Safe to re-run (IF NOT EXISTS). Covers any env where 028 was only partially applied.

CREATE INDEX IF NOT EXISTS idx_pihps_raw_perf
  ON pihps_raw(city_raw, commodity_raw, date DESC);

CREATE INDEX IF NOT EXISTS idx_cities_name_lower
  ON cities(lower(name));
