"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";

interface Alert {
  id: string;
  type: "anomaly" | "arbitrage";
  severity: "high" | "medium" | "low";
  commodity_name: string;
  // Anomaly fields
  city_name?: string;
  price?: number;
  het_ha?: number;
  excess_percent?: number;
  // Arbitrage fields
  city_from?: string;
  city_to?: string;
  price_buy?: number;
  price_sell?: number;
  price_spread?: number;
  spread_percent?: number;
  profit_estimate?: number;
  transport_cost?: number;
  volume_kg?: number;
  vendor_name?: string;
  // AI fields
  insights?: string[];
  recommended_actions?: string[];
  risk_factors?: string[];
  ai_signal?: "BELI" | "TUNGGU" | "HINDARI";
  ai_confidence?: number;
  // State
  is_read: boolean;
  created_at: string;
}

const severityBadge: Record<string, string> = {
  high:   "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
  medium: "bg-[#fef3c7] text-[#78350f] border border-[#fde68a]",
  low:    "bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]",
};

const signalBadge: Record<string, string> = {
  BELI:    "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]",
  TUNGGU:  "bg-[#fef3c7] text-[#78350f] border border-[#fde68a]",
  HINDARI: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[10px] font-mono py-[2px] text-ink-mid">
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

export function AlertCard({ alert, onRead }: { alert: Alert; onRead: (id: string) => void }) {
  const isAnomaly    = alert.type === "anomaly";
  const isArbitrage  = alert.type === "arbitrage";

  // Visual distinction: arbitrage = green left border, anomaly = red left border
  const borderColor = isArbitrage ? "border-l-[#16a34a]" : "border-l-dn";
  const borderCls   = alert.is_read
    ? "border-rule"
    : `border-l-[3px] ${borderColor} border-rule`;

  // Header background: subtle green tint for arbitrage
  const headerBg = isArbitrage ? "bg-[#f0fdf4]" : "bg-paper-2";

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden cursor-pointer transition-opacity ${borderCls} ${alert.is_read ? "opacity-70" : ""}`}
      onClick={() => !alert.is_read && onRead(alert.id)}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-[9px] ${headerBg} border-b border-rule`}>
        <span className="text-[11px]">{isAnomaly ? "⚠" : "💰"}</span>
        <span className={`px-[5px] py-[1px] rounded-[3px] text-[8px] font-bold font-mono uppercase ${isArbitrage ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
          {isArbitrage ? "ARBITRASE" : "ANOMALI"}
        </span>
        <div className="font-serif text-[12px] font-bold flex-1">{alert.commodity_name}</div>
        <span className={`px-[7px] py-[2px] rounded-[4px] text-[9px] font-bold font-mono ${severityBadge[alert.severity]}`}>
          {alert.severity.toUpperCase()}
        </span>
        {alert.ai_signal && (
          <span className={`px-[7px] py-[2px] rounded-[4px] text-[9px] font-bold font-mono ${signalBadge[alert.ai_signal]}`}>
            🤖 {alert.ai_signal}
          </span>
        )}
        {!alert.is_read && <span className="w-2 h-2 rounded-full bg-dn shrink-0" />}
      </div>

      {/* Body */}
      <div className="px-3 py-[9px]">
        {isAnomaly && (
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Kota"       value={alert.city_name ?? "—"} />
            <Row label="Harga"      value={alert.price != null ? fmtRp(alert.price) : "—"} />
            <Row label="HET"        value={alert.het_ha != null ? fmtRp(alert.het_ha) : "—"} />
            <Row label="Di atas HET" value={<span className="text-dn">+{alert.excess_percent?.toFixed(1)}%</span>} />
          </div>
        )}

        {isArbitrage && (
          <>
            {/* Route */}
            <div className="flex items-center gap-2 mb-[6px] text-[11px]">
              <span className="font-mono font-semibold text-ink">{alert.city_from ?? "—"}</span>
              <span className="text-ink-dim">→</span>
              <span className="font-mono font-semibold text-ink">{alert.city_to ?? "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <Row label="Harga Beli"  value={alert.price_buy != null ? fmtRp(alert.price_buy) : "—"} />
              <Row label="Harga Jual"  value={alert.price_sell != null ? fmtRp(alert.price_sell) : "—"} />
              <Row label="Spread"      value={<span className="text-up">{alert.spread_percent?.toFixed(1)}%</span>} />
              <Row label="Transport"   value={alert.transport_cost != null ? fmtRp(alert.transport_cost) : "—"} />
              <Row label="Volume"      value={alert.volume_kg != null ? `${alert.volume_kg.toLocaleString()} kg` : "—"} />
              <Row label="Est. Profit" value={
                <span className={alert.profit_estimate != null && alert.profit_estimate >= 0 ? "text-up font-bold" : "text-dn font-bold"}>
                  {alert.profit_estimate != null ? fmtRp(alert.profit_estimate) : "—"}
                </span>
              } />
            </div>
            {alert.vendor_name && (
              <div className="text-[9px] font-mono text-ink-dim mt-1">
                🚛 Via: {alert.vendor_name}
              </div>
            )}
          </>
        )}

        {/* AI Insights — only for arbitrage */}
        {isArbitrage && alert.insights && alert.insights.length > 0 && (
          <div className="mt-2 pt-2 border-t border-rule">
            <div className="font-mono text-[9px] text-ink-dim mb-1">🤖 AI Insight</div>
            {alert.insights.slice(0, 3).map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.4]">· {s}</div>
            ))}
          </div>
        )}

        {/* Recommended actions */}
        {isArbitrage && alert.recommended_actions && alert.recommended_actions.length > 0 && (
          <div className="mt-1">
            <div className="font-mono text-[9px] text-ink-dim mb-1">📋 Rekomendasi</div>
            {alert.recommended_actions.slice(0, 2).map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.4]">→ {s}</div>
            ))}
          </div>
        )}

        {/* Risk factors */}
        {isArbitrage && alert.risk_factors && alert.risk_factors.length > 0 && (
          <div className="mt-1">
            <div className="font-mono text-[9px] text-ink-dim mb-1">⚠ Risiko</div>
            {alert.risk_factors.slice(0, 2).map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.4]">! {s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { Alert };
