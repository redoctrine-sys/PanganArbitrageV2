"use client";

import { useRef, useState } from "react";
import type { IngestResponse, ParsedRow, PreviewResponse } from "@/types/sp2kp";
import { parseSP2KP } from "@/lib/csv/sp2kp-parser";
import { formatDateShort } from "@/lib/utils/date";
import { DropZone } from "./DropZone";
import { PreviewBlock, ResultBlock, type PreviewState } from "./UploadBlocks";

interface Props {
  onClose: () => void;
  onIngestSuccess: () => void;
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
      } catch { /* fallback to local-only if Supabase not set */ }

      setPreview({
        fileName: file.name, file,
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
      });
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
      if (!res.ok) { setError(json?.error ?? "Gagal ingest"); return; }
      setResult(json as IngestResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ingest");
    } finally {
      setBusy("idle");
    }
  }

  const dateRange = preview?.dates_found.length
    ? `${formatDateShort(preview.dates_found[0])} – ${formatDateShort(preview.dates_found[preview.dates_found.length - 1])} (${preview.dates_found.length} hari)`
    : "—";

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-hd">
          <div className="w-1 h-[22px] rounded-[3px] bg-sp shrink-0" />
          <div className="flex-1">
            <div className="font-serif text-[14px] font-bold">Upload SP2KP</div>
            <div className="font-mono text-[10px] text-ink-dim mt-[2px]">
              Tabulasi_SP2KP.XLSX atau .CSV — Jawa · Madura · Bali · Lombok
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-bd">
          {!preview && !result && (
            <DropZone busy={busy === "parsing"} onPick={() => fileInputRef.current?.click()} onDrop={handleFile} />
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          {preview && !result && <PreviewBlock state={preview} dateRange={dateRange} />}
          {result && <ResultBlock result={result} />}
          {error && (
            <div className="mt-3 bg-dn-bg text-dn border border-[#fecaca] rounded-[6px] px-3 py-2 text-[12px]">
              ⚠ {error}
            </div>
          )}
        </div>

        <div className="modal-ft">
          {result ? (
            <button className="btn btn-green" onClick={onIngestSuccess}>✓ Lihat data</button>
          ) : (
            <>
              {preview && (
                <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={busy !== "idle"}>
                  ← Pilih file lain
                </button>
              )}
              <button className="btn btn-ghost" onClick={onClose} disabled={busy !== "idle"}>Batal</button>
              {preview && (
                <button className="btn btn-green" onClick={handleIngest}
                  disabled={busy !== "idle" || preview.total_parsed === 0}>
                  {busy === "ingesting" ? "Mengingest..." : `✓ Ingest ${preview.total_parsed.toLocaleString("id-ID")} rows`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
