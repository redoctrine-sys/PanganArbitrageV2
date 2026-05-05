export interface ScrapedPrice {
  source: "pihps" | "paskomnas" | "facebook";
  commodity_raw: string;
  price: number;            // Normalized to actual Rp (NOT /1000)
  unit: string;             // Always normalized to "kg"
  city_raw: string;
  date: string;             // YYYY-MM-DD
  market_name?: string;
  original_price?: number;  // Before normalization
  original_unit?: string;   // e.g. "100g", "pack", "ikat"
  confidence: number;       // 0-1, AI normalization confidence
}

export interface ScrapeRunResult {
  source: string;
  status: "success" | "partial" | "failed";
  rows_scraped: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  duration_ms: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}
