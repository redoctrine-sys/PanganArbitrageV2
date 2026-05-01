import { describe, it, expect } from "vitest";
import { islandFromKode, parseSP2KP } from "./sp2kp-parser";
import { PRICE_SCALE, HET_ANOMALY_THRESHOLD } from "@/lib/constants";

// ── helpers ──────────────────────────────────────────────────────────────────

function csvBuf(csv: string): ArrayBuffer {
  const enc = new TextEncoder().encode(csv);
  return enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);
}

/** Returns a past date string DD/MM/YYYY (yesterday) */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}

/** Returns a future date string DD/MM/YYYY (next year) */
function nextYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}

const D1 = yesterday();

/** Minimal valid CSV with one data row */
function minimalCsv(
  opts: {
    kode?: string;
    kota?: string;
    komoditas?: string;
    het?: string | number;
    price?: string | number;
    date?: string;
  } = {},
): string {
  const k = opts.kode ?? "3101";
  const kota = opts.kota ?? "Jakarta Pusat";
  const kom = opts.komoditas ?? "Bawang Merah";
  const het = opts.het ?? "41.5";
  const price = opts.price ?? "35";
  const date = opts.date ?? D1;
  // note trailing spaces on "Komoditas " and "HET/HA " — mirrors real SP2KP files
  return `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${date}\n${k},${kota},${kom},${het},${price}\n`;
}

// ── islandFromKode ────────────────────────────────────────────────────────────

describe("islandFromKode", () => {
  it.each([
    ["3526", "Madura"],
    ["3527", "Madura"],
    ["3528", "Madura"],
    ["3529", "Madura"],
  ])("kode %s → Madura", (kode, expected) => {
    expect(islandFromKode(kode)).toBe(expected);
  });

  it.each([
    ["3101", "Jawa"],
    ["3201", "Jawa"],
    ["3501", "Jawa"], // prefix 35 but not Madura
    ["3601", "Jawa"],
  ])("kode %s → Jawa", (kode, expected) => {
    expect(islandFromKode(kode)).toBe(expected);
  });

  it("kode 51xx → Bali", () => {
    expect(islandFromKode("5101")).toBe("Bali");
  });

  it("kode 52xx → Lombok", () => {
    expect(islandFromKode("5201")).toBe("Lombok");
  });
});

// ── parseSP2KP ────────────────────────────────────────────────────────────────

describe("parseSP2KP — price scaling", () => {
  it("multiplies price by PRICE_SCALE", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ price: "35" })));
    expect(rows[0].price).toBe(35 * PRICE_SCALE);
  });

  it("multiplies HET/HA by PRICE_SCALE", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ het: "41.5" })));
    expect(rows[0].het_ha).toBe(41.5 * PRICE_SCALE);
  });

  it("null HET/HA cell → het_ha is null", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ het: "" })));
    expect(rows[0].het_ha).toBeNull();
  });
});

describe("parseSP2KP — header trimming", () => {
  it("strips trailing space from 'Komoditas ' column", () => {
    // The CSV has 'Komoditas ' (with trailing space) in the header.
    // If not trimmed, the column won't be found and rows will be skipped.
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ komoditas: "Bawang Merah" })));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].commodity_raw).toBe("Bawang Merah");
  });

  it("strips trailing space from 'HET/HA ' column", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ het: "41.5" })));
    expect(rows[0].het_ha).toBe(41.5 * PRICE_SCALE);
  });
});

describe("parseSP2KP — scope filter", () => {
  it("includes kode with prefix 31–36", () => {
    for (const prefix of ["31", "32", "33", "34", "35", "36"]) {
      const { rows } = parseSP2KP(csvBuf(minimalCsv({ kode: `${prefix}01` })));
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it("includes kode with prefix 51 (Bali)", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ kode: "5101" })));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("excludes kode with out-of-scope prefix (71 = Sulawesi)", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ kode: "7101" })));
    expect(rows.length).toBe(0);
  });

  it("excludes prefix 52 city NOT in Lombok list", () => {
    const csv = minimalCsv({ kode: "5201", kota: "Kab. Sumbawa" });
    const { rows } = parseSP2KP(csvBuf(csv));
    expect(rows.length).toBe(0);
  });

  it("includes prefix 52 city IN Lombok list (Kab. Lombok Barat)", () => {
    const csv = minimalCsv({ kode: "5201", kota: "Kab. Lombok Barat" });
    const { rows } = parseSP2KP(csvBuf(csv));
    expect(rows.length).toBeGreaterThan(0);
  });

  it("includes Kota Mataram (Lombok)", () => {
    const csv = minimalCsv({ kode: "5271", kota: "Kota Mataram" });
    const { rows } = parseSP2KP(csvBuf(csv));
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("parseSP2KP — date parsing", () => {
  it("parses DD/MM/YYYY header to YYYY-MM-DD", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ date: "03/04/2026" })));
    expect(rows[0].date).toBe("2026-04-03");
  });

  it("parses D/M/YYYY (no leading zeros) header", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ date: "3/4/2026" })));
    expect(rows[0].date).toBe("2026-04-03");
  });

  it("skips future date columns with warning", () => {
    const futureDate = nextYear();
    const csv =
      `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${D1},${futureDate}\n` +
      `3101,Jakarta Pusat,Bawang Merah,41.5,35,99\n`;
    const { rows, warnings } = parseSP2KP(csvBuf(csv));
    // Only past date rows included
    expect(rows.every((r) => !r.date.startsWith(String(new Date().getFullYear() + 1)))).toBe(true);
    expect(warnings.some((w) => w.includes("masa depan"))).toBe(true);
  });

  it("deduplicates repeated date columns — takes first occurrence", () => {
    // Two columns with same date: result should have 1 row per city×commodity, not 2
    const csv =
      `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${D1},${D1}\n` +
      `3101,Jakarta Pusat,Bawang Merah,41.5,35,99\n`;
    const { rows } = parseSP2KP(csvBuf(csv));
    expect(rows.length).toBe(1);
  });

  it("throws when no date columns found", () => {
    const csv = `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,Kolom Lain\n3101,Jakarta Pusat,Bawang Merah,41.5,35\n`;
    expect(() => parseSP2KP(csvBuf(csv))).toThrow("Tidak ditemukan kolom tanggal");
  });
});

describe("parseSP2KP — null price handling", () => {
  it("skips empty price cell with warning", () => {
    // Two date columns; second price is empty
    const csv =
      `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${D1}\n` +
      `3101,Jakarta Pusat,Bawang Merah,41.5,\n`;
    const { rows, warnings } = parseSP2KP(csvBuf(csv));
    expect(rows.length).toBe(0);
    expect(warnings.some((w) => w.includes("harga kosong"))).toBe(true);
  });
});

describe("parseSP2KP — stats", () => {
  it("returns correct total_rows_file", () => {
    const { total_rows_file } = parseSP2KP(csvBuf(minimalCsv()));
    expect(total_rows_file).toBe(1);
  });

  it("returns correct total_rows_scope (unique city×commodity pairs)", () => {
    const csv =
      `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${D1}\n` +
      `3101,Jakarta Pusat,Bawang Merah,41.5,35\n` +
      `3201,Kab. Bogor,Cabai Merah,,25\n`;
    const { total_rows_scope } = parseSP2KP(csvBuf(csv));
    expect(total_rows_scope).toBe(2);
  });

  it("returns dates_found in ascending order", () => {
    const d1 = "01/04/2026";
    const d2 = "15/04/2026";
    const csv =
      `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${d2},${d1}\n` +
      `3101,Jakarta Pusat,Bawang Merah,41.5,35,36\n`;
    const { dates_found } = parseSP2KP(csvBuf(csv));
    expect(dates_found).toEqual(["2026-04-01", "2026-04-15"]);
  });
});

describe("parseSP2KP — error cases", () => {
  it("throws on file with < 2 rows", () => {
    const csv = `Kode Wilayah,Kabupaten Kota,Komoditas ,HET/HA ,${D1}\n`;
    expect(() => parseSP2KP(csvBuf(csv))).toThrow();
  });

  it("throws when required headers missing", () => {
    const csv = `WrongHeader,Kabupaten Kota,Komoditas ,HET/HA ,${D1}\nval,val,val,val,35\n`;
    expect(() => parseSP2KP(csvBuf(csv))).toThrow("Header tidak valid");
  });
});

describe("parseSP2KP — HET_ANOMALY_THRESHOLD integration", () => {
  it("het_ha × HET_ANOMALY_THRESHOLD gives threshold used in UI", () => {
    const { rows } = parseSP2KP(csvBuf(minimalCsv({ het: "41.5", price: "43" })));
    const { het_ha, price } = rows[0];
    // UI checks: price > het_ha * HET_ANOMALY_THRESHOLD
    expect(het_ha).not.toBeNull();
    const threshold = (het_ha as number) * HET_ANOMALY_THRESHOLD;
    expect(price > threshold).toBe(true); // 43000 > 41500 * 1.02 = 42330 ✓
  });
});
