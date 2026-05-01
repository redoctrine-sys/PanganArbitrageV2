// @domain: arbitrage-agent
// @feature: types

export interface PricePoint {
  kode_wilayah: string;
  city_name: string;
  commodity_id: string;
  commodity_name: string;
  price: number;
  het_ha: number | null;
  date: string;
  province: string;
  island: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Vendor {
  id: string;
  name: string;
  pricing_type: "per_km" | "flat_per_trip";
  price: number;
  capacity_kg: number | null;
  base_fare_rp: number | null;
  base_km: number | null;
  coverage: string | null;
}

export interface AnomalyAlert {
  type: "anomaly";
  severity: "high" | "medium" | "low";
  commodity_id: string;
  commodity_name: string;
  city_name: string;
  kode_wilayah: string;
  price: number;
  het_ha: number;
  excess_percent: number;
}

export interface ArbitrageOpportunity {
  type: "arbitrage";
  severity: "high" | "medium" | "low";
  commodity_id: string;
  commodity_name: string;
  city_from: string;
  city_to: string;
  price_buy: number;
  price_sell: number;
  price_spread: number;
  spread_percent: number;
  volume_kg: number;
  transport_cost: number;
  profit_estimate: number;
  vendor_name: string | null;
  distance_km: number;
  transport_detail: string;
}

export interface GeminiAnalysis {
  insights: string[];
  recommended_actions: string[];
  risk_factors: string[];
  ai_signal: "BELI" | "TUNGGU" | "HINDARI";
  ai_confidence: number;
}

export interface AlertRunResult {
  run_id: string;
  anomalies: AnomalyAlert[];
  opportunities: ArbitrageOpportunity[];
  total_inserted: number;
  gemini_used: boolean;
  timestamp: string;
}
