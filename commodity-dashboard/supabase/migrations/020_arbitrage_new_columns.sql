-- Migration 020: Add risk columns (019 re-guard) + new spread/volatility/profit fields
-- Safe: all ADD COLUMN IF NOT EXISTS — idempotent if 019 was already applied.

ALTER TABLE arbitrage_alerts
  -- From 019 (re-guard in case not applied)
  ADD COLUMN IF NOT EXISTS eta_hours             numeric,
  ADD COLUMN IF NOT EXISTS volatility_pct        numeric,
  ADD COLUMN IF NOT EXISTS volatility_label      text,
  ADD COLUMN IF NOT EXISTS spread_duration       text,
  ADD COLUMN IF NOT EXISTS logistic_risk         text,
  -- New: split volatility per city
  ADD COLUMN IF NOT EXISTS volatility_pct_from   numeric,
  ADD COLUMN IF NOT EXISTS volatility_label_from text,
  -- New: spread divergence analysis
  ADD COLUMN IF NOT EXISTS spread_divergence_days integer,
  ADD COLUMN IF NOT EXISTS spread_divergence_date date,
  ADD COLUMN IF NOT EXISTS avg_spread_pct        numeric,
  -- New: profit using avg prices
  ADD COLUMN IF NOT EXISTS profit_estimate_avg   numeric;

NOTIFY pgrst, 'reload schema';
