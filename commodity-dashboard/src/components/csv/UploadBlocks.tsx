"use client";

import type { IngestResponse, PreviewResponse } from "@/types/sp2kp";
import type { ParsedRow } from "@/types/sp2kp";
import { formatRupiah } from "@/lib/analytics/metrics";

function Stat({ label, value, accentClass }: { label: string; value: string; accentClass?: string }) {
  return (
    <div className="sc">
      <div className="sc-l">{label}</div>
      <div className={`sc-v ${accentClass ?? ""}`}>{value}</div>
    </div>
  );
}

export interface PreviewState extends PreviewResponse {
  fileName: string;
  file: File;
}

export function PreviewBlock({ state, dateRange }: { state: PreviewState; dateRange: string }) {
  const willInsert = state.rows_will_insert.toLocaleString("id-ID");
  return (
    <div>
      <div className="font-mono text-[11px] text-ink-dim mb-[10px]">
        File: <span className="text-ink">{state.fileName}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Total baris file"          value={state.total_rows_file.toLocaleString("id-ID")} />
        <Stat label="Pasangan kota×komoditas"   value={state.total_rows_scope.toLocaleString("id-ID")} />
        <Stat label="Tanggal"                   value={dateRange} />
        <Stat label="Kota unik"                 value={state.unique_cities.toLocaleString("id-ID")} />
        <Stat label="Baris baru (estimasi)"     value={willInsert} accentClass="text-sp" />
        <Stat label="Sudah ada di DB"           value={state.existing_rows.toLocaleString("id-ID")} />
      </div>

      <div className="bg-paper-3 text-ink-mid rounded-[6px] px-[10px] py-2 text-[11px] mb-[10px]">
        ℹ Baris yang sudah ada akan di-<b>UPDATE</b> jika harga/HET berubah,
        atau di-<b>SKIP</b> jika nilainya sama.
      </div>

      {state.warnings.length > 0 && (
        <div className="bg-paper-3 text-ink-mid rounded-[6px] px-[10px] py-2 text-[11px] mb-[10px]">
          {state.warnings.map((w, i) => <div key={i}>· {w}</div>)}
        </div>
      )}

      <div className="font-mono text-[10px] text-ink-dim mb-1">Preview 10 baris pertama:</div>
      <div className="border border-rule rounded-[6px] overflow-hidden">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Tanggal</th><th>Kode</th><th>Kota</th>
              <th>Komoditas</th>
              <th className="text-right">Harga</th>
              <th className="text-right">HET/HA</th>
            </tr>
          </thead>
          <tbody>
            {state.rows_preview.map((r: ParsedRow, i: number) => (
              <tr key={i}>
                <td className="mono">{r.date}</td>
                <td className="mono">{r.kode_wilayah}</td>
                <td>{r.city_raw}</td>
                <td>{r.commodity_raw}</td>
                <td className="mono text-right text-sp">{formatRupiah(r.price)}</td>
                <td className="mono text-right text-ink-dim">{r.het_ha == null ? "—" : formatRupiah(r.het_ha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResultBlock({ result }: { result: IngestResponse }) {
  return (
    <div>
      <div className="bg-sp-light text-sp border border-sp rounded-[6px] px-3 py-[10px] text-[12px] mb-3 font-semibold">
        ✓ Ingest selesai — {result.received.toLocaleString("id-ID")} baris diproses
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Insert (baru)"     value={result.inserted.toLocaleString("id-ID")}  accentClass="text-sp" />
        <Stat label="Update (berubah)"  value={result.updated.toLocaleString("id-ID")}   accentClass="text-warn" />
        <Stat label="Skip (nilai sama)" value={result.unchanged.toLocaleString("id-ID")} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-[10px]">
        <Stat label="Kota baru di-seed"   value={result.cities_seeded.toLocaleString("id-ID")} />
        <Stat label="city_id di-backfill" value={result.rows_backfilled.toLocaleString("id-ID")} />
      </div>
      {result.parse_warnings.length > 0 && (
        <div className="bg-paper-3 text-ink-mid rounded-[6px] px-[10px] py-2 text-[11px] mb-[10px]">
          {result.parse_warnings.map((w, i) => <div key={i}>· {w}</div>)}
        </div>
      )}
      {result.unresolved_commodities.length > 0 && (
        <div className="bg-warn-bg text-warn border border-[#fde68a] rounded-[6px] px-[10px] py-2 text-[11px] mb-[10px]">
          ⚠ {result.unresolved_commodities.length} komoditas tidak match seed:{" "}
          <span className="font-mono">
            {result.unresolved_commodities.slice(0, 5).join(", ")}
            {result.unresolved_commodities.length > 5 ? `, +${result.unresolved_commodities.length - 5}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
