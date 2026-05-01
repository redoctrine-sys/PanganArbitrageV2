-- ═══════════════════════════════════════
-- 017 — arbitrage_alerts: add transport_detail and distance_km columns
-- Menyimpan rincian kalkulasi transport per arbitrage opportunity.
-- ═══════════════════════════════════════

ALTER TABLE arbitrage_alerts
  ADD COLUMN IF NOT EXISTS distance_km      numeric,
  ADD COLUMN IF NOT EXISTS transport_detail text;
