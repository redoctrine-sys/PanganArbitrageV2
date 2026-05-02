-- Migration 021: Add weight_loss_pct column for dynamic shrinkage risk
-- Interpolated from eta_hours + distance_km: short (<5h/<100km) 2%-5%, long (>12h) 10%-15%.

ALTER TABLE arbitrage_alerts
  ADD COLUMN IF NOT EXISTS weight_loss_pct numeric;

NOTIFY pgrst, 'reload schema';
