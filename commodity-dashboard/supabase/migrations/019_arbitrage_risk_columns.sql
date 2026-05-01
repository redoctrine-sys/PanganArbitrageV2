-- Add logistics risk columns to arbitrage_alerts
ALTER TABLE arbitrage_alerts
  ADD COLUMN IF NOT EXISTS eta_hours        numeric,
  ADD COLUMN IF NOT EXISTS volatility_pct   numeric,
  ADD COLUMN IF NOT EXISTS volatility_label text,
  ADD COLUMN IF NOT EXISTS spread_duration  text,
  ADD COLUMN IF NOT EXISTS logistic_risk    text;

NOTIFY pgrst, 'reload schema';
