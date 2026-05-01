// SP2KP harga tersimpan dalam ribuan (mis. 35 = Rp 35.000). Parser kalikan sekali.
export const PRICE_SCALE = 1000;

// Harga > HET × threshold = anomali. 1.02 = toleransi 2% di atas HET.
export const HET_ANOMALY_THRESHOLD = 1.02;

// Slope < threshold (rasio) = trend flat di calcTrend().
export const TREND_FLAT_THRESHOLD = 0.01;

// Default dan batas hari untuk query chart history.
export const CHART_DAYS_DEFAULT = 30;
export const CHART_DAYS_MAX = 400;

// Batas baris per query Supabase untuk /api/prices.
export const PRICE_LIMIT_PER_QUERY = 5000;
