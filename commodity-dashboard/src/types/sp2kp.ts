export type Island = "Jawa" | "Madura" | "Bali" | "Lombok";

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  city_raw: string;
  commodity_raw: string;
  price: number;
  het_ha: number | null;
  kode_wilayah: string;
}

export interface ParseStats {
  dates_found: string[];
  total_rows_file: number; // jumlah baris data di file (exclude header)
  total_rows_scope: number; // jumlah pasangan kota×komoditas dalam scope
  total_observations: number; // jumlah observasi (rows × tanggal) yg lolos
  warnings: string[];
}

export interface ParseResult extends ParseStats {
  rows: ParsedRow[];
}

export interface PreviewResponse extends ParseStats {
  rows_preview: ParsedRow[];
  total_parsed: number;
  // Baris yang sudah ada di prices_raw (date, city_raw, commodity_raw, source).
  // Saat ingest: row di-UPDATE bila price/het_ha berubah, di-SKIP bila sama.
  existing_rows: number;
  rows_will_insert: number;
  unique_cities: number;
}

// Response dari /api/ingest/sp2kp setelah RPC bulk_insert_sp2kp_prices.
// Conditional upsert membagi hasil jadi 3 kategori (lihat 005_bulk_insert_fn.sql).
export interface IngestResponse {
  received: number;     // total row di-parse + lolos scope filter
  inserted: number;     // row baru (belum ada di DB)
  updated: number;      // row ada, price/het_ha berubah → ditulis ulang
  unchanged: number;    // row ada, nilai sama → di-skip
  cities_seeded: number;
  rows_backfilled: number;
  chunks_processed: number;
  parse_warnings: string[];
  unresolved_commodities: string[];
}

// Phase 1: SP2KP raw row dari RPC get_sp2kp_latest. kode_wilayah + city_raw
// langsung dari prices_raw (no JOIN ke cities table). province/island/
// entity_type di-derive dari kode_wilayah di server (RPC SQL).
export interface SP2KPLatestRow {
  kode_wilayah: string;
  city_raw: string;
  province: string;
  island: Island;
  entity_type: "kota" | "kabupaten" | "provinsi" | null;
  commodity_id: string;
  commodity_name: string;
  category: "bumbu" | "pokok" | "protein" | null;
  unit: string;
  // price_latest / date_latest nullable: kota dalam scope (prefix 31-36/51/52)
  // yang belum punya data SP2KP — mis. 6 kota DKI Jakarta — tetap muncul di
  // grid sebagai placeholder. Lihat migration 009.
  price_latest: number | null;
  price_prev: number | null;
  het_ha: number | null;
  date_latest: string | null;
  date_prev: string | null;
  avg_30d: number | null;
  max_30d: number | null;
  min_30d: number | null;
  obs_30d: number;
}

export interface PricePoint {
  date: string;
  price: number;
  het_ha: number | null;
}

export interface CandleData {
  /** Period label, e.g. "W12 Mar" or "Mar 2026" */
  label: string;
  /** Period start date ISO for sorting */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Number of daily observations in this period */
  volume: number;
}
