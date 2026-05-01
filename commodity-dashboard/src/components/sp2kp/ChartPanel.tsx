"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceLineChart } from "@/components/charts/PriceLineChart";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { calcChangePct, calcVolatility, calcVsAvg, formatPct, formatRupiah } from "@/lib/analytics/metrics";
import type { CandleData, PricePoint, SP2KPLatestRow } from "@/types/sp2kp";

interface Props {
  row: SP2KPLatestRow;
}

type ChartMode = "D" | "W" | "M";

const MODE_CONFIG: Record<ChartMode, { days: number; label: string; subtitle: string }> = {
  D: { days: 30,  label: "D",  subtitle: "Harian · 30 hari terakhir" },
  W: { days: 365, label: "W",  subtitle: "Candlestick mingguan · 1 tahun" },
  M: { days: 365, label: "M",  subtitle: "Candlestick bulanan · 1 tahun" },
};

const ID_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/* ── OHLC Aggregation ─────────────────────────────── */

/** Get ISO week number (Mon=start) */
function isoWeekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function aggregateCandles(
  points: PricePoint[],
  mode: "W" | "M",
): CandleData[] {
  if (points.length === 0) return [];

  const groups = new Map<string, PricePoint[]>();
  for (const p of points) {
    const key = mode === "W" ? isoWeekKey(p.date) : monthKey(p.date);
    let arr = groups.get(key);
    if (!arr) { arr = []; groups.set(key, arr); }
    arr.push(p);
  }

  const candles: CandleData[] = [];
  for (const [key, pts] of groups) {
    // Sort by date ascending within group
    pts.sort((a, b) => a.date.localeCompare(b.date));

    const open  = pts[0].price;
    const close = pts[pts.length - 1].price;
    let high = -Infinity, low = Infinity;
    for (const p of pts) {
      if (p.price > high) high = p.price;
      if (p.price < low) low = p.price;
    }

    let label: string;
    if (mode === "W") {
      // e.g. "W12 Mar"
      const d = new Date(pts[0].date + "T00:00:00Z");
      const weekNum = key.split("-W")[1];
      label = `W${weekNum} ${ID_MONTHS_SHORT[d.getUTCMonth()]}`;
    } else {
      // e.g. "Mar 2026"
      const [y, m] = key.split("-").map(Number);
      label = `${ID_MONTHS_SHORT[m - 1]} ${y}`;
    }

    candles.push({
      label,
      date: pts[0].date,
      open,
      high,
      low,
      close,
      volume: pts.length,
    });
  }

  candles.sort((a, b) => a.date.localeCompare(b.date));
  return candles;
}

/* ── Component ────────────────────────────────────── */

export function ChartPanel({ row }: Props) {
  const [mode, setMode] = useState<ChartMode>("D");
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const config = MODE_CONFIG[mode];

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams({
          kode_wilayah: row.kode_wilayah,
          commodity_id: row.commodity_id,
          days: String(config.days),
        });
        const res = await fetch(`/api/prices?${params.toString()}`);
        const json = await res.json();
        if (!cancel) {
          if (json.error) setErr(json.error);
          setPoints((json.data ?? []) as PricePoint[]);
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Gagal memuat chart");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [row.kode_wilayah, row.commodity_id, config.days]);

  const candles = useMemo(() => {
    if (mode === "D") return [];
    return aggregateCandles(points, mode);
  }, [points, mode]);

  const change = calcChangePct(row.price_latest, row.price_prev);
  const volatility = calcVolatility(row.max_30d, row.min_30d, row.avg_30d);
  const vsAvg = calcVsAvg(row.price_latest, row.avg_30d);

  const hetDelta =
    row.het_ha != null && row.price_latest != null
      ? ((row.price_latest - row.het_ha) / row.het_ha) * 100
      : null;
  const aboveHet = hetDelta != null && hetDelta > 0;

  return (
    <div className="ce-grid">
      <div className="ce-chart">
        <div className="flex items-start justify-between mb-[7px]">
          <div>
            <div className="font-serif text-[12px] font-bold">
              {row.city_raw} — {row.commodity_name}
            </div>
            <div className="font-mono text-[9px] text-ink-dim mt-[2px]">
              SP2KP · {config.subtitle} · Garis merah putus = HET
            </div>
          </div>
          <div className="flex gap-[1px] p-[2px] bg-paper-2 border border-rule rounded-[5px]">
            {(["D", "W", "M"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`font-mono px-2 py-[3px] rounded-[4px] text-[10px] font-medium cursor-pointer border-none ${
                  mode === m
                    ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]"
                    : "bg-transparent text-ink-dim"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="font-mono h-[200px] flex items-center justify-center text-[11px] text-ink-dim">
            Memuat...
          </div>
        ) : err ? (
          <div className="font-mono h-[200px] flex items-center justify-center text-[11px] text-dn">
            {err}
          </div>
        ) : mode === "D" ? (
          <PriceLineChart
            points={points}
            het={row.het_ha}
            avg30={row.avg_30d}
            height={200}
          />
        ) : (
          <CandlestickChart
            candles={candles}
            het={row.het_ha}
            height={200}
          />
        )}
      </div>

      <div className="ce-stats">
        <div className="st-title">{row.city_raw} · {row.commodity_name}</div>
        <div className="st-row">
          <span className="st-k">Harga hari ini</span>
          <span className="st-v text-sp">
            {formatRupiah(row.price_latest)}
          </span>
        </div>
        <div className="st-row">
          <span className="st-k">vs kemarin</span>
          <span className="st-v"><ChangePill value={change} /></span>
        </div>
        <div className="st-row">
          <span className="st-k">Avg 30 hari</span>
          <span className="st-v">{formatRupiah(row.avg_30d ?? null)}</span>
        </div>
        <div className="st-row">
          <span className="st-k">vs rata-rata</span>
          <span className="st-v">
            {vsAvg == null ? "—" : <span className={`pill ${vsAvg < 0 ? "pill-up" : "pill-dn"}`}>
              {vsAvg > 0 ? "▲" : "▼"}{formatPct(vsAvg)}
            </span>}
          </span>
        </div>
        <div className="st-row">
          <span className="st-k">Min – Max 30 hari</span>
          <span className="st-v">
            {formatRupiah(row.min_30d ?? null)} – {formatRupiah(row.max_30d ?? null)}
          </span>
        </div>
        <div className="st-row">
          <span className="st-k">Volatilitas</span>
          <span className="st-v"><VolatilityPill value={volatility} withLabel /></span>
        </div>
        <div className="st-row">
          <span className="st-k">HET (SP2KP)</span>
          <span className={`st-v ${row.het_ha == null ? "text-ink-dim" : "text-ink"}`}>
            {row.het_ha == null ? (
              <span className="text-[10px]">— tidak tersedia</span>
            ) : (
              <>
                {formatRupiah(row.het_ha)}{" "}
                <span className={`text-[9px] ${aboveHet ? "text-dn" : "text-lo"}`}>
                  {aboveHet ? `↑ +${hetDelta?.toFixed(1)}%` : `✓ di bawah`}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="st-row">
          <span className="st-k">Observasi 30 hari</span>
          <span className="st-v">{row.obs_30d}</span>
        </div>
      </div>
    </div>
  );
}
