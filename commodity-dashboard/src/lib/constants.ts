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

// ─── Phase 2: Arbitrage thresholds ──────────────────────────────────────────

// Minimum net profit (Rp) untuk dianggap peluang arbitrase.
export const MIN_PROFIT_THRESHOLD = 50_000;

// Minimum spread antar kota (%) untuk dianggap peluang arbitrase.
export const MIN_SPREAD_PERCENT = 0.10;

// ─── Phase 2: Province & island mapping ─────────────────────────────────────

export const PROVINCE_MAP: Record<string, string> = {
  "31": "DKI Jakarta",
  "32": "Jawa Barat",
  "33": "Jawa Tengah",
  "34": "DI Yogyakarta",
  "35": "Jawa Timur",
  "36": "Banten",
  "51": "Bali",
  "52": "Nusa Tenggara Barat",
};

export const ISLAND_MAP: Record<string, string> = {
  "31": "Jawa", "32": "Jawa", "33": "Jawa",
  "34": "Jawa", "35": "Jawa", "36": "Jawa",
  "3526": "Madura", "3527": "Madura", "3528": "Madura", "3529": "Madura",
  "51": "Bali",
  "52": "Lombok",
};

// ─── Phase 2: Commodity categories ──────────────────────────────────────────

export const COMMODITY_CATEGORIES = {
  POKOK:   ["Beras Medium", "Beras Premium", "Tepung Terigu", "Gula Pasir Curah"],
  BUMBU:   ["Bawang Merah", "Bawang Putih Honan", "Cabai Merah Besar", "Cabai Merah Keriting", "Cabai Rawit Merah", "Garam Halus"],
  PROTEIN: ["Daging Ayam Ras", "Daging Sapi Paha Belakang", "Ikan Kembung", "Telur Ayam Ras"],
  MINYAK:  ["Minyak Goreng Sawit Curah", "Minyak Goreng Sawit Kemasan Premium", "Minyakita"],
} as const;

