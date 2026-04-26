import * as XLSX from "xlsx";
import type { Island, ParsedRow, ParseResult } from "@/types/sp2kp";

// Kode wilayah Madura — meski prefix '35' (Jatim), island = 'Madura'
const MADURA_CODES = new Set(["3526", "3527", "3528", "3529"]);

// NTB (prefix 52) hanya Lombok yang masuk scope
const LOMBOK_INCLUDE = new Set([
  "Kab. Lombok Barat",
  "Kab. Lombok Tengah",
  "Kab. Lombok Timur",
  "Kab. Lombok Utara",
  "Kota Mataram",
]);

const SCOPE_PREFIXES = new Set([
  "31", "32", "33", "34", "35", "36", "51", "52",
]);

const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

// SP2KP menyimpan harga dalam satuan RIBU (mis. cell `35` = Rp 35.000,
// `12.813` = Rp 12.813, HET `41.5` = Rp 41.500). Konversi sekali di parser
// sebagai single source of truth — semua downstream code (UI/RPC/chart)
// melihat angka rupiah utuh.
const PRICE_SCALE = 1000;

// Excel serial dates can appear in headers when XLSX is exported without
// preserving the cell format. SP2KP files often mix DD/MM/YYYY strings with
// monthly serial columns (1st-of-month aggregates) — handle both.
// Offset 25569 = days from 1899-12-30 (Excel epoch, accounting for the
// 1900 leap-year bug) to 1970-01-01 (Unix epoch). Accurate for any date ≥ 1900-03-01.
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function headerToIsoDate(header: unknown): string | null {
  if (typeof header === "number") return excelSerialToIso(header);
  if (typeof header !== "string") return null;
  const trimmed = header.trim();
  const m = DATE_PATTERN.exec(trimmed);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Some exports keep serials as numeric strings.
  if (/^\d{4,6}$/.test(trimmed)) return excelSerialToIso(Number(trimmed));
  return null;
}

export function islandFromKode(kode: string): Island {
  if (MADURA_CODES.has(kode)) return "Madura";
  const prefix = kode.substring(0, 2);
  if (prefix === "51") return "Bali";
  if (prefix === "52") return "Lombok";
  return "Jawa";
}

export function parseSP2KP(fileBuffer: ArrayBuffer): ParseResult {
  const warnings: string[] = [];

  const wb = XLSX.read(fileBuffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File tidak punya sheet apapun");
  const ws = wb.Sheets[sheetName];

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  });
  if (raw.length < 2) throw new Error("File kosong atau tidak valid");

  const headerRaw = raw[0] as unknown[];
  // Strip whitespace dari header text — kolom 'Komoditas ' & 'HET/HA ' punya trailing space.
  // Numeric (Excel serial) headers dipertahankan sebagai number untuk konversi tanggal.
  const headerStr = headerRaw.map((h) =>
    typeof h === "string" ? h.trim() : typeof h === "number" ? String(h) : "",
  );

  const idxKode      = headerStr.indexOf("Kode Wilayah");
  const idxKota      = headerStr.indexOf("Kabupaten Kota");
  const idxKomoditas = headerStr.indexOf("Komoditas");
  const idxHet       = headerStr.indexOf("HET/HA");

  if (idxKode < 0 || idxKota < 0 || idxKomoditas < 0) {
    throw new Error(
      "Header tidak valid — pastikan file adalah Tabulasi SP2KP (kolom: Kode Wilayah, Kabupaten Kota, Komoditas, HET/HA, dan tanggal).",
    );
  }

  // Build date columns: terima DD/MM/YYYY string atau Excel serial (number/numeric-string).
  const dateColumns: { idx: number; dateStr: string }[] = [];
  for (let i = 0; i < headerRaw.length; i++) {
    const iso = headerToIsoDate(headerRaw[i]);
    if (iso) dateColumns.push({ idx: i, dateStr: iso });
  }
  // Sort ascending by date so chart series datang berurutan.
  dateColumns.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  // Hilangkan duplikat tanggal (kolom monthly aggregate yang sama dgn salah satu daily).
  const seenDates = new Set<string>();
  const uniqueDateColumns = dateColumns.filter((d) => {
    if (seenDates.has(d.dateStr)) return false;
    seenDates.add(d.dateStr);
    return true;
  });

  if (uniqueDateColumns.length === 0) {
    throw new Error("Tidak ditemukan kolom tanggal (DD/MM/YYYY atau Excel serial).");
  }

  const dates_found = uniqueDateColumns.map((d) => d.dateStr);
  const total_rows_file = raw.length - 1;

  const rows: ParsedRow[] = [];
  const cityCommodityPairs = new Set<string>();
  let skippedNullPrice = 0;

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[] | undefined;
    if (!r || r.length === 0) continue;

    const kodeWilayah = String(r[idxKode] ?? "").trim();
    const cityRaw     = String(r[idxKota] ?? "").trim();
    const commRaw     = String(r[idxKomoditas] ?? "").trim();

    if (!kodeWilayah || !cityRaw || !commRaw) continue;

    const prefix = kodeWilayah.substring(0, 2);
    if (!SCOPE_PREFIXES.has(prefix)) continue;
    if (prefix === "52" && !LOMBOK_INCLUDE.has(cityRaw)) continue;

    const hetRaw = idxHet >= 0 ? r[idxHet] : null;
    const het_ha =
      hetRaw != null && hetRaw !== "" && !Number.isNaN(Number(hetRaw))
        ? Number(hetRaw) * PRICE_SCALE
        : null;

    cityCommodityPairs.add(`${cityRaw}||${commRaw}`);

    for (const { idx, dateStr } of uniqueDateColumns) {
      const priceRaw = r[idx];
      if (priceRaw == null || priceRaw === "" || Number.isNaN(Number(priceRaw))) {
        skippedNullPrice++;
        continue;
      }
      rows.push({
        date: dateStr,
        city_raw: cityRaw,
        commodity_raw: commRaw,
        price: Number(priceRaw) * PRICE_SCALE,
        het_ha,
        kode_wilayah: kodeWilayah,
      });
    }
  }

  if (skippedNullPrice > 0) {
    warnings.push(`${skippedNullPrice} cell harga kosong dilewati (normal untuk hari libur).`);
  }
  if (rows.length === 0) {
    warnings.push("Tidak ada baris yang lolos filter scope (Jawa/Madura/Bali/Lombok).");
  }

  return {
    rows,
    dates_found,
    total_rows_file,
    total_rows_scope: cityCommodityPairs.size,
    total_observations: rows.length,
    warnings,
  };
}
