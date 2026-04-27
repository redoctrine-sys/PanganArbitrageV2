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
  duplicates_skipped: number;
  rows_will_insert: number;
  new_cities: string[];
  unique_cities: number;
}

// Phase 1: SP2KP raw row dari RPC get_sp2kp_latest. kode_wilayah + city_raw
// langsung dari prices_raw (no JOIN ke cities table). province/island/
// entity_type di-derive dari kode_wilayah di server (RPC SQL).
export interface SP2KPLatestRow {
  kode_wilayah: string;
  city_raw: string;
  province: string;
  island: Island;
  entity_type: "kota" | "kabupaten" | null;
  commodity_id: string;
  commodity_name: string;
  category: "bumbu" | "pokok" | "protein" | null;
  unit: string;
  price_latest: number;
  price_prev: number | null;
  het_ha: number | null;
  date_latest: string;
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
