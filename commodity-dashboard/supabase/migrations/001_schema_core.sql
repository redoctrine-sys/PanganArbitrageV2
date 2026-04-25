-- ═══════════════════════════════════════
-- 001 — Core tables: cities, commodities, prices_raw
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS cities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  name_sp2kp   text,
  province     text,
  island       text CHECK (island IN ('Jawa','Madura','Bali','Lombok')),
  entity_type  text CHECK (entity_type IN ('kota','kabupaten')),
  kode_wilayah text UNIQUE,
  lat          numeric(9,6),
  lng          numeric(9,6)
);

CREATE TABLE IF NOT EXISTS commodities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  unit          text DEFAULT 'kg',
  category      text CHECK (category IN ('bumbu','pokok','protein')),
  is_sp2kp      boolean DEFAULT true,
  source_origin text DEFAULT 'sp2kp'
);

CREATE TABLE IF NOT EXISTS prices_raw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL,
  city_raw      text NOT NULL,
  commodity_raw text NOT NULL,
  city_id       uuid REFERENCES cities(id),
  commodity_id  uuid REFERENCES commodities(id),
  price         numeric(12,2) NOT NULL,
  het_ha        numeric(12,2),
  source        text NOT NULL DEFAULT 'sp2kp',
  kode_wilayah  text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(date, city_raw, commodity_raw, source)
);

CREATE INDEX IF NOT EXISTS idx_pr_date     ON prices_raw(date DESC);
CREATE INDEX IF NOT EXISTS idx_pr_source   ON prices_raw(source);
CREATE INDEX IF NOT EXISTS idx_pr_approved ON prices_raw(city_id, commodity_id, date DESC)
  WHERE city_id IS NOT NULL AND commodity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_city_null ON prices_raw(city_id) WHERE city_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pr_comm_null ON prices_raw(commodity_id) WHERE commodity_id IS NULL;
