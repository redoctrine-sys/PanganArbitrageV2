"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";
import type { ArbitrageAlertUI } from "./alert-card.types";
import { CalcRow, parseTransportOptions } from "./alert-card.utils";
import { TransportOptionsAccordion } from "./TransportOptionsAccordion";

export function ArbitrageCalcBreakdown({ alert }: { alert: ArbitrageAlertUI }) {
  const vol         = alert.volume_kg ?? 1000;
  const modalBeli   = alert.price_buy * vol;
  const hasilJual   = alert.price_sell * vol;
  const grossProfit = hasilJual - modalBeli;
  const netProfit   = alert.transport_cost != null ? grossProfit - alert.transport_cost : null;
  const roi         = netProfit != null && modalBeli > 0 ? (netProfit / modalBeli) * 100 : null;
  const transportOptions = parseTransportOptions(alert.transport_detail);

  return (
    <div>
      <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
        📊 Rincian Perhitungan
      </div>
      <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
        <CalcRow
          label={`Modal Beli (${vol.toLocaleString()} kg × ${fmtRp(alert.price_buy)})`}
          value={fmtRp(modalBeli)}
          dimmed
        />
        <CalcRow
          label={`Hasil Jual (${vol.toLocaleString()} kg × ${fmtRp(alert.price_sell)})`}
          value={fmtRp(hasilJual)}
          dimmed
        />
        <CalcRow label="Gross Profit (Jual − Beli)" value={fmtRp(grossProfit)} borderTop />
        <CalcRow
          label={`Biaya Transport${alert.vendor_name ? ` (${alert.vendor_name})` : ""}`}
          value={alert.transport_cost != null ? `− ${fmtRp(alert.transport_cost)}` : "—"}
        />
        <TransportOptionsAccordion
          options={transportOptions}
          distanceKm={alert.distance_km}
          defaultEtaHours={alert.eta_hours}
          priceSell={alert.price_sell}
        />
        <CalcRow label="NET PROFIT" value={netProfit != null ? fmtRp(netProfit) : "—"} highlight borderTop />
        {roi != null && (
          <CalcRow
            label="ROI"
            value={<span className={roi >= 0 ? "text-up" : "text-dn"}>{roi.toFixed(2)}%</span>}
          />
        )}
        {alert.ai_confidence != null && (
          <CalcRow label="Confidence AI" value={`${Math.round(alert.ai_confidence * 100)}%`} dimmed />
        )}
      </div>
    </div>
  );
}
