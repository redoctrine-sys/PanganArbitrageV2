"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { AlertCard, type Alert } from "./AlertCard";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

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

export function AlertCenter() {
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [lastRun, setLastRun]       = useState<string | null>(null);
  const [runInfo, setRunInfo]       = useState<RunResult | null>(null);
  const [apiError, setApiError]     = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSev, setFilterSev]   = useState<FilterSeverity>("all");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const supabase = getClient();
    const { data, error } = await supabase
      .from("arbitrage_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Table might not exist yet
      console.warn("[AlertCenter] DB load error:", error.message);
    }
    setAlerts((data ?? []) as Alert[]);
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

      if (!res.ok) {
        setApiError(json.error ?? `HTTP ${res.status}`);
        return;
      }

      if (json.error) {
        setApiError(json.error);
        return;
      }

      setLastRun(json.timestamp ?? new Date().toISOString());

      // If DB insert worked, reload from DB. If not (db_error), use API response directly.
      if (!json.db_error) {
        await loadAlerts();
      } else {
        // Merge in-memory from API response (table missing scenario)
        const fromApi: Alert[] = [
          ...((json.anomalies ?? []) as Alert[]),
          ...((json.opportunities ?? []) as Alert[]),
        ].map((a) => ({ ...a, is_read: false, created_at: json.timestamp ?? "" }));
        setAlerts(fromApi);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  async function markRead(id: string) {
    const supabase = getClient();
    await supabase.from("arbitrage_alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
  }

  const filtered = alerts.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterSev  !== "all" && a.severity !== filterSev)  return false;
    return true;
  });

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
            {t === "all" ? "Semua" : t === "anomaly" ? "⚠ Anomali" : "📈 Arbitrase"}
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

      {/* Status bar */}
      <div className="shrink-0 px-[18px] pt-[8px] flex flex-col gap-2">
        {/* Success */}
        {lastRun && !apiError && (
          <div className="px-3 py-[6px] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-[10px] font-mono text-[#166534] flex gap-3 items-center">
            <span>✓ Analisis selesai — {new Date(lastRun).toLocaleString("id-ID")}</span>
            {runInfo?.total_inserted != null && (
              <span className="opacity-70">·  {runInfo.total_inserted} alerts disimpan</span>
            )}
            {runInfo?.gemini_used && <span className="opacity-70">· 🤖 Gemini aktif</span>}
            {runInfo?.db_error && (
              <span className="text-[#78350f]">· ⚠ DB skip (migration 014 belum dijalankan)</span>
            )}
            {runInfo?.warning && <span className="opacity-70">· {runInfo.warning}</span>}
          </div>
        )}
        {/* Error */}
        {apiError && (
          <div className="px-3 py-[6px] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[10px] font-mono text-[#991b1b] leading-[1.6]">
            <b>Error:</b> {apiError}
            {apiError.includes("Supabase") && (
              <div className="opacity-70 mt-1">Pastikan SUPABASE_SERVICE_ROLE_KEY dikonfigurasi di Vercel env vars.</div>
            )}
          </div>
        )}
      </div>

      {/* Metrics info strip — only after run */}
      {runInfo && !apiError && (
        <div className="mx-[18px] mt-[6px] px-3 py-[6px] bg-paper-2 border border-rule rounded-lg shrink-0">
          <div className="font-mono text-[9px] text-ink-dim uppercase tracking-[0.8px] mb-1">Hasil Analisis</div>
          <div className="flex gap-4 flex-wrap">
            <Metric label="Anomali HET" value={String(runInfo.anomalies?.length ?? 0)} />
            <Metric label="Peluang Arbitrase" value={String(runInfo.opportunities?.length ?? 0)} />
            <Metric label="Data SP2KP" value={`${alerts.length} total`} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-[12px_18px]">
        {loading && (
          <div className="empty"><div className="empty-title">Memuat alerts...</div></div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty">
            <div className="text-[28px] mb-2">🤖</div>
            <div className="empty-title">Belum ada alerts</div>
            <div className="empty-sub">
              Klik <b>Jalankan Analisis</b> untuk mendeteksi anomali harga &amp; peluang arbitrase dari data SP2KP terbaru.
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            {filtered.map((a, i) => (
              <AlertCard key={a.id ?? `${a.type}-${a.commodity_name}-${i}`}
                alert={a} onRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="font-mono text-[9px] text-ink-dim">{label}:</span>
      <span className="font-mono text-[11px] font-bold text-ink">{value}</span>
    </div>
  );
}
