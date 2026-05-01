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

export function AlertCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSev, setFilterSev] = useState<FilterSeverity>("all");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const supabase = getClient();
    const { data } = await supabase
      .from("arbitrage_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setAlerts((data ?? []) as Alert[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function runAgent() {
    setRunning(true);
    try {
      const res = await fetch("/api/agents/arbitrage", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setLastRun(json.timestamp);
        await loadAlerts();
      }
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
    if (filterSev !== "all" && a.severity !== filterSev) return false;
    return true;
  });

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div className="fbar">
        <span className="font-mono text-[10px] font-semibold text-ink-dim">TIPE</span>
        {(["all", "anomaly", "arbitrage"] as FilterType[]).map((t) => (
          <button key={t} type="button" className={`fbtn${filterType === t ? " on" : ""}`} onClick={() => setFilterType(t)}>
            {t === "all" ? "Semua" : t === "anomaly" ? "⚠ Anomali" : "📈 Arbitrase"}
          </button>
        ))}
        <div className="w-px h-[14px] bg-rule mx-1" />
        {(["all", "high", "medium", "low"] as FilterSeverity[]).map((s) => (
          <button key={s} type="button" className={`fbtn${filterSev === s ? " on" : ""}`} onClick={() => setFilterSev(s)}>
            {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {unread > 0 && (
            <span className="font-mono text-[10px] text-dn font-semibold">{unread} belum dibaca</span>
          )}
          <button type="button" className="btn btn-arb text-[10px] px-3 py-[5px]"
            onClick={runAgent} disabled={running}>
            {running ? "⏳ Menganalisis..." : "🤖 Jalankan Analisis"}
          </button>
        </div>
      </div>

      {/* Last run info */}
      {lastRun && (
        <div className="mx-[18px] mt-[8px] px-3 py-[6px] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-[10px] font-mono text-[#166534] shrink-0">
          ✓ Analisis selesai — {new Date(lastRun).toLocaleString("id-ID")}
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
              Klik <b>Jalankan Analisis</b> untuk mendeteksi anomali harga & peluang arbitrase dari data SP2KP terbaru.
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            {filtered.map((a) => (
              <AlertCard key={a.id} alert={a} onRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
