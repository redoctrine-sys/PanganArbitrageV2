"use client";

import type { ArbitrageAlertUI } from "./alert-card.types";
import { CalcRow, fmtEta, parseTransportOptions } from "./alert-card.utils";

export function LogisticsRiskPanel({ alert }: { alert: ArbitrageAlertUI }) {
  if (alert.eta_hours == null && alert.volatility_pct == null) return null;

  const transportOptions = parseTransportOptions(alert.transport_detail);

  return (
    <div>
      <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
        🚛 Analisis Risiko Logistik
      </div>
      <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
        {(transportOptions.length > 0 || alert.eta_hours != null) && (
          <div className="mb-[6px]">
            <div className="text-[9px] font-mono text-ink-dim mb-[3px]">Estimasi Perjalanan per Kendaraan:</div>
            {transportOptions.length > 0
              ? transportOptions.map((opt, idx) => (
                  <div key={idx} className="flex justify-between text-[10px] font-mono py-[2px]">
                    <span className="text-ink-mid">{opt.vendor_name} ({opt.capacity_kg.toLocaleString()} kg)</span>
                    <span className="font-semibold text-ink">
                      {fmtEta(opt.eta_hours ?? alert.eta_hours ?? 0, alert.distance_km)}
                    </span>
                  </div>
                ))
              : alert.eta_hours != null && (
                  <div className="text-[10px] font-mono text-ink-mid">
                    {fmtEta(alert.eta_hours, alert.distance_km)}
                  </div>
                )
            }
          </div>
        )}
        {alert.weight_loss_pct != null && (
          <CalcRow
            label="Risiko Penyusutan Bobot"
            value={
              <span className={alert.weight_loss_pct >= 10 ? "text-dn" : alert.weight_loss_pct >= 5 ? "text-[#78350f]" : "text-ink"}>
                ~{alert.weight_loss_pct.toFixed(1)}%
                {alert.weight_loss_pct < 5 ? " (Pendek)" : alert.weight_loss_pct < 10 ? " (Menengah)" : " (Jauh)"}
              </span>
            }
          />
        )}
        {alert.volatility_pct_from != null && (
          <CalcRow
            label="Volatilitas Harga (Asal)"
            value={
              <span className={
                alert.volatility_label_from === "Tinggi" ? "text-dn" :
                alert.volatility_label_from === "Sedang" ? "text-[#78350f]" : "text-up"
              }>
                {alert.volatility_pct_from.toFixed(1)}% ({alert.volatility_label_from ?? "—"})
              </span>
            }
          />
        )}
        {alert.volatility_pct != null && (
          <CalcRow
            label="Volatilitas Harga (Tujuan)"
            value={
              <span className={
                alert.volatility_label === "Tinggi" ? "text-dn" :
                alert.volatility_label === "Sedang" ? "text-[#78350f]" : "text-up"
              }>
                {alert.volatility_pct.toFixed(1)}% ({alert.volatility_label ?? "—"})
              </span>
            }
          />
        )}
        {alert.spread_duration && (
          <CalcRow label="Status Spread" value={alert.spread_duration} dimmed />
        )}
        {alert.logistic_risk && (
          <div className="text-[10px] font-mono mt-[6px] p-2 bg-[#fee2e2] text-[#991b1b] rounded border border-[#fecaca] leading-[1.5]">
            {alert.logistic_risk}
          </div>
        )}
      </div>
    </div>
  );
}
