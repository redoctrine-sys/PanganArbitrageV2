"use client";

import { useEffect, useState } from "react";
import { PriceLineChart } from "@/components/charts/PriceLineChart";
import { ChangePill } from "@/components/pills/ChangePill";
import { VolatilityPill } from "@/components/pills/VolatilityPill";
import { calcChangePct, calcVolatility, calcVsAvg, formatPct, formatRupiah } from "@/lib/analytics/metrics";
import type { PricePoint, SP2KPLatestRow } from "@/types/sp2kp";

interface Props {
  row: SP2KPLatestRow;
}

type Range = 7 | 30 | 90;

export function ChartPanel({ row }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams({
          kode_wilayah: row.kode_wilayah,
          commodity_id: row.commodity_id,
          days: String(range),
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
  }, [row.kode_wilayah, row.commodity_id, range]);

  const change = calcChangePct(row.price_latest, row.price_prev);
  const volatility = calcVolatility(row.max_30d, row.min_30d, row.avg_30d);
  const vsAvg = calcVsAvg(row.price_latest, row.avg_30d);

  const hetDelta =
    row.het_ha != null ? ((row.price_latest - row.het_ha) / row.het_ha) * 100 : null;
  const aboveHet = hetDelta != null && hetDelta > 0;

  return (
    <div className="ce-grid">
      <div className="ce-chart">
        <div className="flex items-start justify-between" style={{ marginBottom: 7 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 12, fontWeight: 700 }}>
              {row.city_raw} — {row.commodity_name}
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 9, color: "var(--ink-dim)", marginTop: 2 }}
            >
              SP2KP harian · Garis merah putus = HET (jika tersedia)
            </div>
          </div>
          <div
            style={{
              display: "flex", gap: 1, padding: 2,
              background: "var(--paper2)", border: "1px solid var(--rule)",
              borderRadius: 5,
            }}
          >
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className="font-mono"
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 500,
                  background: range === r ? "white" : "transparent",
                  color: range === r ? "var(--ink)" : "var(--ink-dim)",
                  boxShadow: range === r ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {r === 7 ? "D" : r === 30 ? "W" : "M"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div
            className="font-mono"
            style={{
              height: 200, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, color: "var(--ink-dim)",
            }}
          >
            Memuat...
          </div>
        ) : err ? (
          <div
            className="font-mono"
            style={{
              height: 200, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, color: "var(--dn)",
            }}
          >
            {err}
          </div>
        ) : (
          <PriceLineChart
            points={points}
            het={row.het_ha}
            avg30={row.avg_30d}
            height={200}
          />
        )}
      </div>

      <div className="ce-stats">
        <div className="st-title">{row.city_raw} · {row.commodity_name}</div>
        <div className="st-row">
          <span className="st-k">Harga hari ini</span>
          <span className="st-v" style={{ color: "var(--sp)" }}>
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
          <span className="st-v" style={{ color: row.het_ha == null ? "var(--ink-dim)" : "var(--ink)" }}>
            {row.het_ha == null ? (
              <span style={{ fontSize: 10 }}>— tidak tersedia</span>
            ) : (
              <>
                {formatRupiah(row.het_ha)}{" "}
                <span style={{ fontSize: 9, color: aboveHet ? "var(--dn)" : "var(--lo)" }}>
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
