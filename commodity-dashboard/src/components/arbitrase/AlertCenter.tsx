"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCard, type Alert } from "./AlertCard";

type FilterType = "all" | "anomaly" | "arbitrage";
type FilterSeverity = "all" | "high" | "medium" | "low";

interface RunResult {
  run_id?: string;
  anomalies?: Alert[];
  opportunities?: Alert[];
  total_inserted?: number;
  gemini_used?: boolean;
  timestamp?: string;
  warning?: string;
  db_error?: string;
  error?: string;
}

interface Counts { arbitrage: number; anomaly: number; total: number }

export function AlertCenter() {
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [counts, setCounts]         = useState<Counts>({ arbitrage: 0, anomaly: 0, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [lastRun, setLastRun]       = useState<string | null>(null);
  const [runInfo, setRunInfo]       = useState<RunResult | null>(null);
  const [apiError, setApiError]     = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSev, setFilterSev]   = useState<FilterSeverity>("all");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/agents/arbitrage", { cache: "no-store" });
      const json = await res.json() as { data?: Alert[]; counts?: Counts };
      setAlerts((json.data ?? []) as Alert[]);
      if (json.counts) setCounts(json.counts);
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function runAgent() {
    setRunning(true);
    setApiError(null);
    setRunInfo(null);
    try {
      const res  = await fetch("/api/agents/arbitrage", { method: "POST" });
      const json = await res.json() as RunResult;
      setRunInfo(json);

      if (!res.ok || json.error) {
        setApiError(json.error ?? `HTTP ${res.status}`);
        const fromApi: Alert[] = [
          ...((json.anomalies ?? []) as Alert[]),
          ...((json.opportunities ?? []) as Alert[]),
        ].map((a) => ({ ...a, is_read: false, created_at: json.timestamp ?? "" }));
        if (fromApi.length > 0) setAlerts(fromApi);
        return;
      }

      setLastRun(json.timestamp ?? new Date().toISOString());

      if (json.db_error) {
        const fromApi: Alert[] = [
          ...((json.opportunities ?? []) as Alert[]),
          ...((json.anomalies ?? []) as Alert[]),
        ].map((a) => ({ ...a, is_read: false, created_at: json.timestamp ?? "" }));
        setAlerts(fromApi);
        setCounts({
          arbitrage: json.opportunities?.length ?? 0,
          anomaly: json.anomalies?.length ?? 0,
          total: fromApi.length,
        });
      } else {
        await loadAlerts();
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  async function markRead(id: string) {
    try { await fetch(`/api/agents/arbitrage?id=${id}`, { method: "PATCH" }); } catch {}
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
  }

  // Client-side filter
  const filtered = alerts.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterSev  !== "all" && a.severity !== filterSev)  return false;
    return true;
  });

  // Split into sections for display
  const arbAlerts  = filtered.filter((a) => a.type === "arbitrage");
  const anomAlerts = filtered.filter((a) => a.type === "anomaly");

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="fbar">
        <span className="font-mono text-[10px] font-semibold text-ink-dim">TIPE</span>
        {(["all", "anomaly", "arbitrage"] as FilterType[]).map((t) => (
          <button key={t} type="button"
            className={`fbtn${filterType === t ? " on" : ""}`}
            onClick={() => setFilterType(t)}>
            {t === "all"
              ? `Semua (${counts.total})`
              : t === "anomaly"
                ? `⚠ Anomali (${counts.anomaly})`
                : `💰 Arbitrase (${counts.arbitrage})`}
          </button>
        ))}
        <div className="w-px h-[14px] bg-rule mx-1" />
        {(["all", "high", "medium", "low"] as FilterSeverity[]).map((s) => (
          <button key={s} type="button"
            className={`fbtn${filterSev === s ? " on" : ""}`}
            onClick={() => setFilterSev(s)}>
            {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {unread > 0 && (
            <span className="font-mono text-[10px] text-dn font-semibold">
              {unread} belum dibaca
            </span>
          )}
          <button type="button"
            className="btn btn-arb text-[10px] px-3 py-[5px]"
            onClick={runAgent} disabled={running}>
            {running ? "⏳ Menganalisis..." : "🤖 Jalankan Analisis"}
          </button>
        </div>
      </div>

      {/* Status messages */}
      <div className="shrink-0 px-[18px] pt-[8px] flex flex-col gap-2">
        {lastRun && !apiError && (
          <div className="px-3 py-[6px] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-[10px] font-mono text-[#166534] flex gap-3 items-center flex-wrap">
            <span>✓ Analisis selesai — {new Date(lastRun).toLocaleString("id-ID")}</span>
            {runInfo?.total_inserted != null && <span className="opacity-70">· {runInfo.total_inserted} alerts disimpan</span>}
            {runInfo?.gemini_used && <span className="opacity-70">· 🤖 Gemini aktif</span>}
            {runInfo?.db_error && <span className="text-[#78350f]">· ⚠ DB: {runInfo.db_error}</span>}
          </div>
        )}
        {apiError && (
          <div className="px-3 py-[6px] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[10px] font-mono text-[#991b1b]">
            <b>Error:</b> {apiError}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-[12px_18px]">
        {loading && <div className="empty"><div className="empty-title">Memuat alerts...</div></div>}

        {!loading && alerts.length === 0 && (
          <div className="empty">
            <div className="text-[28px] mb-2">🤖</div>
            <div className="empty-title">Belum ada alerts</div>
            <div className="empty-sub">
              Klik <b>Jalankan Analisis</b> untuk mendeteksi anomali harga &amp; peluang arbitrase dari data SP2KP terbaru.
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && alerts.length > 0 && (
          <div className="empty py-8">
            <div className="text-[22px] mb-2">🔍</div>
            <div className="empty-title">Tidak ada alert dengan filter ini</div>
            <div className="empty-sub">
              Ada <b>{alerts.length}</b> alert tersimpan — coba ubah filter.
            </div>
            <button type="button" className="btn btn-ghost mt-3 text-[11px]"
              onClick={() => { setFilterType("all"); setFilterSev("all"); }}>
              Reset Filter
            </button>
          </div>
        )}

        {/* === ARBITRAGE SECTION (shown first — this is what user cares about) === */}
        {!loading && arbAlerts.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-[8px]">
              <span className="text-[13px]">💰</span>
              <div className="font-serif text-[13px] font-bold">Peluang Arbitrase</div>
              <span className="font-mono text-[10px] text-ink-dim">{arbAlerts.length} peluang</span>
            </div>
            <div className="flex flex-col gap-[8px]">
              {arbAlerts.map((a, i) => (
                <AlertCard
                  key={a.id ?? `arb-${a.commodity_name}-${i}`}
                  alert={a}
                  onRead={markRead}
                />
              ))}
            </div>
          </div>
        )}

        {/* === ANOMALY SECTION === */}
        {!loading && anomAlerts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-[8px]">
              <span className="text-[13px]">⚠</span>
              <div className="font-serif text-[13px] font-bold">Anomali Harga (HET)</div>
              <span className="font-mono text-[10px] text-ink-dim">{anomAlerts.length} anomali</span>
            </div>
            <div className="flex flex-col gap-[8px]">
              {anomAlerts.map((a, i) => (
                <AlertCard
                  key={a.id ?? `anom-${a.commodity_name}-${i}`}
                  alert={a}
                  onRead={markRead}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
