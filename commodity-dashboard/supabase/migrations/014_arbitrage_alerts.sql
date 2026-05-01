-- Migration 014: Arbitrage Alerts table (Phase 2)
-- Stores results from Layer 1 (statistical) + Layer 2 (Gemini) analysis.

CREATE TABLE IF NOT EXISTS arbitrage_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL CHECK (type IN ('anomaly', 'arbitrage')),
  severity         text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),

  -- Shared fields
  commodity_id     text,
  commodity_name   text,
  run_id           uuid,                      -- groups alerts from same analysis run

  -- Anomaly-specific
  city_name        text,
  price            numeric,
  het_ha           numeric,
  excess_percent   numeric,                   -- % di atas HET

  -- Arbitrage-specific
  city_from        text,
  city_to          text,
  price_buy        numeric,
  price_sell       numeric,
  price_spread     numeric,
  spread_percent   numeric,
  volume_kg        numeric DEFAULT 1000,
  transport_cost   numeric,
  profit_estimate  numeric,
  vendor_name      text,

  -- AI Layer 2 results
  insights         jsonb,                     -- string[]
  recommended_actions jsonb,                  -- string[]
  risk_factors     jsonb,                     -- string[]
  ai_signal        text,                      -- 'BELI' | 'TUNGGU' | 'HINDARI'
  ai_confidence    numeric,                   -- 0-1

  -- Metadata
  is_read          boolean NOT NULL DEFAULT false,
  source           text DEFAULT 'sp2kp',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_alerts_unread       ON arbitrage_alerts (is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type         ON arbitrage_alerts (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_commodity    ON arbitrage_alerts (commodity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_run          ON arbitrage_alerts (run_id);

-- RLS
ALTER TABLE arbitrage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_alerts"
  ON arbitrage_alerts FOR SELECT
  USING (true);

CREATE POLICY "service_insert_alerts"
  ON arbitrage_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service_update_alerts"
  ON arbitrage_alerts FOR UPDATE
  USING (true);
