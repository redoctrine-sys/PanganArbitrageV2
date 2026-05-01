"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";

interface Alert {
  id: string;
  type: "anomaly" | "arbitrage";
  severity: "high" | "medium" | "low";
  commodity_name: string;
  city_name?: string;
  city_from?: string;
  city_to?: string;
  price?: number;
  het_ha?: number;
  excess_percent?: number;
  price_spread?: number;
  spread_percent?: number;
  profit_estimate?: number;
  insights?: string[];
  recommended_actions?: string[];
  risk_factors?: string[];
  ai_signal?: "BELI" | "TUNGGU" | "HINDARI";
  ai_confidence?: number;
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
  const isAnomaly = alert.type === "anomaly";
  const borderCls = alert.is_read ? "border-rule" : "border-l-[3px] border-l-dn border-rule";

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden cursor-pointer transition-opacity ${borderCls} ${alert.is_read ? "opacity-70" : ""}`}
      onClick={() => !alert.is_read && onRead(alert.id)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-[9px] bg-paper-2 border-b border-rule">
        <span className="text-[11px]">{isAnomaly ? "⚠" : "📈"}</span>
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
        {isAnomaly ? (
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Kota"       value={alert.city_name ?? "—"} />
            <Row label="Harga"      value={alert.price != null ? fmtRp(alert.price) : "—"} />
            <Row label="HET"        value={alert.het_ha != null ? fmtRp(alert.het_ha) : "—"} />
            <Row label="Di atas HET" value={<span className="text-dn">+{alert.excess_percent?.toFixed(1)}%</span>} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Dari"    value={alert.city_from ?? "—"} />
            <Row label="Ke"      value={alert.city_to ?? "—"} />
            <Row label="Spread"  value={`${alert.spread_percent?.toFixed(1)}%`} />
            <Row label="Est. Profit" value={<span className="text-up">{alert.profit_estimate != null ? fmtRp(alert.profit_estimate) : "—"}</span>} />
          </div>
        )}

        {/* AI Insights */}
        {alert.insights && alert.insights.length > 0 && (
          <div className="mt-2 pt-2 border-t border-rule">
            <div className="font-mono text-[9px] text-ink-dim mb-1">🤖 AI Insight</div>
            {alert.insights.slice(0, 2).map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.4]">· {s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { Alert };
