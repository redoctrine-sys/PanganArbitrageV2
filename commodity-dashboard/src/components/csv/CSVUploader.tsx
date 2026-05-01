"use client";

import { useRef, useState } from "react";
import type { IngestResponse, ParsedRow, PreviewResponse } from "@/types/sp2kp";
import { parseSP2KP } from "@/lib/csv/sp2kp-parser";
import { formatRupiah } from "@/lib/analytics/metrics";
import { formatDateShort } from "@/lib/utils/date";

interface Props {
  onClose: () => void;
  onIngestSuccess: () => void;
}

interface PreviewState extends PreviewResponse {
  fileName: string;
  file: File;
}

export function CSVUploader({ onClose, onIngestSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"idle" | "parsing" | "ingesting">("idle");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy("parsing");
    try {
      const buf = await file.arrayBuffer();
      const local = parseSP2KP(buf);

      const fd = new FormData();
      fd.append("file", file);
      let server: PreviewResponse | null = null;
      try {
        const res = await fetch("/api/csv/preview", { method: "POST", body: fd });
        if (res.ok) server = (await res.json()) as PreviewResponse;
      } catch {
        // Fallback ke local-only stats jika Supabase belum di-set.
      }

      const merged: PreviewState = {
        fileName: file.name,
        file,
        rows_preview: local.rows.slice(0, 10),
        total_parsed: local.rows.length,
        total_rows_file: local.total_rows_file,
        total_rows_scope: local.total_rows_scope,
        total_observations: local.total_observations,
        dates_found: local.dates_found,
        warnings: local.warnings,
        unique_cities: new Set(local.rows.map((r: ParsedRow) => r.city_raw)).size,
        existing_rows:    server?.existing_rows ?? 0,
        rows_will_insert: server?.rows_will_insert ?? local.rows.length,
      };
      setPreview(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal parse file");
      setPreview(null);
    } finally {
      setBusy("idle");
    }
  }

  async function handleIngest() {
    if (!preview) return;
    setBusy("ingesting");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", preview.file);
      const res = await fetch("/api/ingest/sp2kp", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Gagal ingest");
        return;
      }
      setResult(json as IngestResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ingest");
    } finally {
      setBusy("idle");
    }
  }

  const dateRange = preview?.dates_found.length
    ? `${formatDateShort(preview.dates_found[0])} – ${formatDateShort(
        preview.dates_found[preview.dates_found.length - 1],
      )} (${preview.dates_found.length} hari)`
    : "—";

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-hd">
          <div className="w-1 h-[22px] rounded-[3px] bg-sp shrink-0" />
          <div className="flex-1">
            <div className="font-serif text-[14px] font-bold">
              Upload SP2KP
            </div>
            <div className="font-mono text-[10px] text-ink-dim mt-[2px]">
              Tabulasi_SP2KP.XLSX atau .CSV — Jawa · Madura · Bali · Lombok
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-bd">
          {!preview && !result && (
            <DropZone
              busy={busy === "parsing"}
              onPick={() => fileInputRef.current?.click()}
              onDrop={(f) => handleFile(f)}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {preview && !result && (
            <PreviewBlock state={preview} dateRange={dateRange} />
          )}

          {result && <ResultBlock result={result} />}

          {error && (
            <div className="mt-3 bg-dn-bg text-dn border border-[#fecaca] rounded-[6px] px-3 py-2 text-[12px]">
              ⚠ {error}
            </div>
          )}
        </div>

        <div className="modal-ft">
          {result ? (
            <button className="btn btn-green" onClick={onIngestSuccess}>
              ✓ Lihat data
            </button>
          ) : (
            <>
              {preview && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setPreview(null)}
                  disabled={busy !== "idle"}
                >
                  ← Pilih file lain
                </button>
              )}
              <button className="btn btn-ghost" onClick={onClose} disabled={busy !== "idle"}>
                Batal
              </button>
              {preview && (
                <button
                  className="btn btn-green"
                  onClick={handleIngest}
                  disabled={busy !== "idle" || preview.total_parsed === 0}
                >
                  {busy === "ingesting"
                    ? "Mengingest..."
                    : `✓ Ingest ${preview.total_parsed.toLocaleString("id-ID")} rows`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DropZone({
  busy, onPick, onDrop,
}: { busy: boolean; onPick: () => void; onDrop: (f: File) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      className={`rounded-[10px] py-10 px-5 text-center transition-all duration-[150ms] ${
        busy ? "cursor-wait" : "cursor-pointer"
      } ${hover ? "bg-sp-light" : "bg-paper-2"}`}
      style={{ border: `2px dashed ${hover ? "var(--sp)" : "var(--rule-mid)"}` }}
    >
      <div className="text-[28px] mb-2">📤</div>
      <div className="font-serif text-[14px] font-semibold mb-1">
        {busy ? "Memparse file..." : "Klik atau drop file di sini"}
      </div>
      <div className="font-mono text-[10px] text-ink-dim">
        .xlsx · .xls · .csv (UTF-16 LE didukung)
      </div>
    </div>
  );
}

function PreviewBlock({ state, dateRange }: { state: PreviewState; dateRange: string }) {
  const willInsert = state.rows_will_insert.toLocaleString("id-ID");
  return (
    <div>
      <div className="font-mono text-[11px] text-ink-dim mb-[10px]">
        File: <span className="text-ink">{state.fileName}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Total baris file" value={state.total_rows_file.toLocaleString("id-ID")} />
        <Stat label="Pasangan kota×komoditas" value={state.total_rows_scope.toLocaleString("id-ID")} />
        <Stat label="Tanggal" value={dateRange} />
        <Stat label="Kota unik" value={state.unique_cities.toLocaleString("id-ID")} />
        <Stat label="Baris baru (estimasi)" value={willInsert} accentClass="text-sp" />
        <Stat label="Sudah ada di DB" value={state.existing_rows.toLocaleString("id-ID")} />
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

      <div className="font-mono text-[10px] text-ink-dim mb-1">
        Preview 10 baris pertama:
      </div>
      <div className="border border-rule rounded-[6px] overflow-hidden">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kode</th>
              <th>Kota</th>
              <th>Komoditas</th>
              <th className="text-right">Harga</th>
              <th className="text-right">HET/HA</th>
            </tr>
          </thead>
          <tbody>
            {state.rows_preview.map((r, i) => (
              <tr key={i}>
                <td className="mono">{r.date}</td>
                <td className="mono">{r.kode_wilayah}</td>
                <td>{r.city_raw}</td>
                <td>{r.commodity_raw}</td>
                <td className="mono text-right text-sp">
                  {formatRupiah(r.price)}
                </td>
                <td className="mono text-right text-ink-dim">
                  {r.het_ha == null ? "—" : formatRupiah(r.het_ha)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultBlock({ result }: { result: IngestResponse }) {
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
            {result.unresolved_commodities.length > 5
              ? `, +${result.unresolved_commodities.length - 5}`
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, accentClass,
}: { label: string; value: string; accentClass?: string }) {
  return (
    <div className="sc">
      <div className="sc-l">{label}</div>
      <div className={`sc-v ${accentClass ?? ""}`}>{value}</div>
    </div>
  );
}
