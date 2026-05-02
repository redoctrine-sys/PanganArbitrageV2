export interface TransportOption {
  vendor_name: string;
  capacity_kg: number;
  cost: number;
  profit: number;
  roi: number;
  breakdown: string;
  eta_hours?: number;
  weight_loss_pct?: number;
}

interface AlertBase {
  id: string;
  severity: "high" | "medium" | "low";
  commodity_name: string;
  is_read: boolean;
  created_at: string;
}

export interface AnomalyAlertUI extends AlertBase {
  type: "anomaly";
  city_name: string;
  price: number;
  het_ha: number;
  excess_percent: number;
}

export interface ArbitrageAlertUI extends AlertBase {
  type: "arbitrage";
  city_from: string;
  city_to: string;
  price_buy: number;
  price_sell: number;
  price_spread?: number;
  spread_percent?: number;
  profit_estimate?: number;
  profit_estimate_avg?: number;
  transport_cost?: number;
  volume_kg?: number;
  vendor_name?: string;
  distance_km?: number;
  transport_detail?: string;
  eta_hours?: number;
  volatility_pct?: number;
  volatility_label?: string;
  volatility_pct_from?: number;
  volatility_label_from?: string;
  spread_duration?: string;
  spread_divergence_days?: number;
  spread_divergence_date?: string;
  avg_spread_pct?: number;
  weight_loss_pct?: number;
  logistic_risk?: string;
  insights?: string[];
  recommended_actions?: string[];
  risk_factors?: string[];
  ai_signal?: "BELI" | "TUNGGU" | "HINDARI";
  ai_confidence?: number;
}

export type Alert = AnomalyAlertUI | ArbitrageAlertUI;

export const severityBadge: Record<string, string> = {
  high:   "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
  medium: "bg-[#fef3c7] text-[#78350f] border border-[#fde68a]",
  low:    "bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]",
};

export const signalBadge: Record<string, string> = {
  BELI:    "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
  TUNGGU:  "bg-[#fef3c7] text-[#78350f] border border-[#fde68a]",
  HINDARI: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
};
