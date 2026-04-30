-- ═══════════════════════════════════════
-- 012 — Transport Vendors table
-- Vendor transportasi untuk kalkulasi arbitrase.
-- Moda: truk, pickup, kapal, motor, lainnya
-- Pricing: per_km (price = Rp/km) atau flat_per_trip (price = Rp flat)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS transport_vendors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  moda          text NOT NULL CHECK (moda IN ('truk', 'pickup', 'kapal', 'motor', 'lainnya')),
  pricing_type  text NOT NULL CHECK (pricing_type IN ('per_km', 'flat_per_trip')),
  price         numeric(12,0) NOT NULL,
  capacity_kg   numeric(10,0),
  coverage      text,
  contact       text,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE transport_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY transport_vendors_public_read ON transport_vendors
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE: service_role bypass RLS otomatis.

-- Seed data dari mockup
INSERT INTO transport_vendors (name, moda, pricing_type, price, capacity_kg, coverage, contact)
VALUES
  ('Truk Pak B***',        'truk',   'per_km',       1200,    8000,  'Jawa · Madura',  NULL),
  ('Pickup Murah',         'pickup', 'per_km',        800,    1500,  'Jawa',           NULL),
  ('Kapal Feri Jawa–Bali', 'kapal',  'flat_per_trip', 2500000, 10000, 'Jawa → Bali',   'Pelni'),
  ('Feri Bali–Lombok',     'kapal',  'flat_per_trip', 1800000,  8000, 'Bali → Lombok', 'Pelni');
