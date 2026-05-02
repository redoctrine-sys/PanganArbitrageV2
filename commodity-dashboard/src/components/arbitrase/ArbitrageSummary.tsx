"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";
import type { ArbitrageAlertUI } from "./alert-card.types";
import { Row, parseTransportOptions } from "./alert-card.utils";

export function ArbitrageSummary({ alert }: { alert: ArbitrageAlertUI }) {
  const transportOptions = parseTransportOptions(alert.transport_detail);
  const bestOption = transportOptions[0] ?? null;
  const vol = alert.volume_kg ?? 1000;

  return (
    <>
      <div className="flex items-center gap-2 mb-[6px] text-[11px]">
        <span className="font-mono font-semibold text-ink">{alert.city_from}</span>
        <span className="text-ink-dim">→</span>
        <span className="font-mono font-semibold text-ink">{alert.city_to}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 mb-[4px]">
        <Row label="Volatilitas Asal" value={
          alert.volatility_pct_from != null
            ? <span className={
                alert.volatility_label_from === "Tinggi" ? "text-dn" :
                alert.volatility_label_from === "Sedang" ? "text-[#78350f]" : "text-up"
              }>{alert.volatility_pct_from.toFixed(1)}% ({alert.volatility_label_from ?? "—"})</span>
            : <span className="text-ink-dim">—</span>
        } />
        <Row label="Volatilitas Tujuan" value={
          alert.volatility_pct != null
            ? <span className={
                alert.volatility_label === "Tinggi" ? "text-dn" :
                alert.volatility_label === "Sedang" ? "text-[#78350f]" : "text-up"
              }>{alert.volatility_pct.toFixed(1)}% ({alert.volatility_label ?? "—"})</span>
            : <span className="text-ink-dim">—</span>
        } />
      </div>
      <div className="border-t border-rule my-[4px]" />

      <div className="grid grid-cols-2 gap-x-4">
        <Row label="Harga Beli"  value={fmtRp(alert.price_buy)} />
        <Row label="Harga Jual"  value={fmtRp(alert.price_sell)} />
        <Row label="Spread"      value={<span className="text-up">{alert.spread_percent?.toFixed(1)}%</span>} />
        <Row label="Transport"   value={alert.transport_cost != null ? fmtRp(alert.transport_cost) : "—"} />
        <Row label="Volume"      value={`${vol.toLocaleString()} kg`} />
        <Row label="Est. Profit (Latest)" value={
          <span className="flex items-center gap-1">
            <span className={alert.profit_estimate != null && alert.profit_estimate >= 0 ? "text-up font-bold" : "text-dn font-bold"}>
              {alert.profit_estimate != null ? fmtRp(alert.profit_estimate) : "—"}
            </span>
            {bestOption != null && (
              <span className="text-up text-[9px]">({bestOption.roi.toFixed(1)}% ROI)</span>
            )}
          </span>
        } />
        <div />
        <Row label="Est. Profit (Avg Divergence)" value={
          <span className={alert.profit_estimate_avg != null && alert.profit_estimate_avg >= 0 ? "text-up font-semibold" : "text-dn font-semibold"}>
            {alert.profit_estimate_avg != null ? fmtRp(alert.profit_estimate_avg) : "—"}
          </span>
        } />
      </div>

      {(alert.spread_divergence_days != null || alert.avg_spread_pct != null) && (
        <div className="mt-[6px] px-[8px] py-[5px] bg-[#f0f9ff] border border-rule rounded-md">
          <div className="font-mono text-[8px] font-bold text-ink-dim uppercase tracking-[0.6px] mb-[3px]">📈 Spread Analisis</div>
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Durasi Divergence" value={
              alert.spread_divergence_days != null
                ? `${alert.spread_divergence_days} hari${alert.spread_divergence_date
                    ? ` (sejak ${new Date(alert.spread_divergence_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`
                    : ""}`
                : "—"
            } />
            <Row label="Avg Spread" value={
              alert.avg_spread_pct != null
                ? <span className={alert.avg_spread_pct >= 0 ? "text-up" : "text-dn"}>
                    {alert.avg_spread_pct >= 0 ? "+" : ""}{alert.avg_spread_pct.toFixed(1)}%
                  </span>
                : "—"
            } />
          </div>
        </div>
      )}

      {alert.vendor_name && (
        <div className="text-[9px] font-mono text-ink-dim mt-1">🚛 Via: {alert.vendor_name}</div>
      )}
    </>
  );
}
