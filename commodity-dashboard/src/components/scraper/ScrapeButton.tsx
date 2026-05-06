"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  event: string;
}

interface TriggerResponse {
  runs: WorkflowRun[];
  configured: boolean;
  error?: string;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  success:    { label: "✅ Sukses",     cls: "bg-[#dcfce7] text-[#166534]" },
  failure:    { label: "❌ Gagal",      cls: "bg-[#fee2e2] text-[#991b1b]" },
  cancelled:  { label: "⏹ Dibatalkan", cls: "bg-[#f3f4f6] text-[#6b7280]" },
  in_progress:{ label: "⏳ Berjalan",  cls: "bg-[#fef3c7] text-[#92400e]" },
  queued:     { label: "🔄 Antrian",   cls: "bg-[#dbeafe] text-[#1e40af]" },
};

export function ScrapeButton({ agent = "pihps" }: { agent?: string }) {
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const { data: triggerData, mutate } = useSWR<TriggerResponse>(
    "/api/scraper/trigger",
    fetcher,
    { refreshInterval: showPanel ? 15000 : 60000 }
  );

  const runs = triggerData?.runs ?? [];
  const configured = triggerData?.configured ?? false;
  const latestRun = runs[0];
  const isRunning = latestRun?.status === "in_progress" || latestRun?.status === "queued";

  async function handleTrigger() {
    setTriggering(true);
    setResult(null);
    try {
      const res = await fetch("/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: json.message ?? "Scraper triggered!" });
        // Poll faster after trigger
        setTimeout(() => mutate(), 3000);
        setTimeout(() => mutate(), 8000);
        setTimeout(() => mutate(), 15000);
      } else {
        setResult({ ok: false, msg: json.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`btn text-[11px] px-3 py-[5px] font-medium flex items-center gap-[5px] ${
            isRunning
              ? "bg-[#fef3c7] text-[#92400e] border-[#f59e0b] cursor-wait"
              : "bg-[#dbeafe] text-[#1e40af] border-[#93c5fd] hover:bg-[#bfdbfe]"
          }`}
          onClick={handleTrigger}
          disabled={triggering || isRunning}
        >
          {triggering ? (
            <>⏳ Triggering...</>
          ) : isRunning ? (
            <>⏳ Scraper sedang berjalan...</>
          ) : (
            <>🔄 Scrape Now</>
          )}
        </button>

        {/* Latest status indicator */}
        {latestRun && (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-ink-dim hover:text-ink cursor-pointer bg-transparent border-none"
            onClick={() => setShowPanel(!showPanel)}
          >
            <span className={`pill text-[9px] ${
              STATUS_BADGE[latestRun.conclusion ?? latestRun.status]?.cls ?? "bg-paper-3 text-ink-dim"
            }`}>
              {STATUS_BADGE[latestRun.conclusion ?? latestRun.status]?.label ?? latestRun.status}
            </span>
            <span className="font-mono">{relativeTime(latestRun.updated_at)}</span>
            <span>{showPanel ? "▴" : "▾"}</span>
          </button>
        )}

        {!configured && (
          <span className="text-[10px] text-[#92400e] font-mono" title="Set GITHUB_PAT di .env.local lalu restart dev server (Ctrl+C → npm run dev)">
            ⚠ GITHUB_PAT belum di-set
          </span>
        )}
      </div>

      {/* Toast */}
      {result && (
        <div className={`mt-1 text-[10px] font-mono px-2 py-1 rounded ${
          result.ok ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"
        }`}>
          {result.msg}
        </div>
      )}

      {/* Recent runs panel */}
      {showPanel && runs.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-[320px] bg-paper border border-rule rounded-lg shadow-lg z-50 p-2">
          <div className="text-[10px] font-bold text-ink-dim uppercase tracking-wide mb-2">
            Recent Scraper Runs
          </div>
          {runs.map((run) => (
            <a
              key={run.id}
              href={run.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-[6px] rounded hover:bg-paper-2 no-underline text-ink-mid"
            >
              <span className={`pill text-[8px] min-w-[72px] text-center ${
                STATUS_BADGE[run.conclusion ?? run.status]?.cls ?? "bg-paper-3 text-ink-dim"
              }`}>
                {STATUS_BADGE[run.conclusion ?? run.status]?.label ?? run.status}
              </span>
              <span className="text-[10px] font-mono flex-1">
                #{run.run_number} · {run.event === "workflow_dispatch" ? "manual" : "cron"}
              </span>
              <span className="text-[9px] text-ink-dim font-mono">
                {relativeTime(run.created_at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
