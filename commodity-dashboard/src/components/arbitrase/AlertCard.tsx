"use client";

import { useState } from "react";
import { type Alert, severityBadge, signalBadge } from "./alert-card.types";
import { AnomalyBody, AnomalyCalcBreakdown } from "./AnomalyDetail";
import { ArbitrageSummary } from "./ArbitrageSummary";
import { ArbitrageCalcBreakdown } from "./ArbitrageCalcBreakdown";
import { LogisticsRiskPanel } from "./LogisticsRiskPanel";
import { AIInsightsPanel } from "./AIInsightsPanel";

export function AlertCard({ alert, onRead }: { alert: Alert; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const anom = alert.type === "anomaly"   ? alert : null;
  const arb  = alert.type === "arbitrage" ? alert : null;

  const borderColor = arb ? "border-l-[#16a34a]" : "border-l-dn";
  const borderCls   = alert.is_read
    ? "border-rule"
    : `border-l-[3px] ${borderColor} border-rule`;
  const headerBg    = arb ? "bg-[#f0fdf4]" : "bg-paper-2";

  function handleClick() {
    setExpanded((v) => !v);
    if (!alert.is_read) onRead(alert.id);
  }

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden cursor-pointer transition-opacity ${borderCls} ${alert.is_read ? "opacity-70" : ""}`}
      onClick={handleClick}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-[9px] ${headerBg} border-b border-rule`}>
        <span className="text-[11px]">{anom ? "⚠" : "💰"}</span>
        <span className={`px-[5px] py-[1px] rounded-[3px] text-[8px] font-bold font-mono uppercase ${arb ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
          {arb ? "ARBITRASE" : "ANOMALI"}
        </span>
        <div className="font-serif text-[12px] font-bold flex-1">{alert.commodity_name}</div>
        <span className={`px-[7px] py-[2px] rounded-[4px] text-[9px] font-bold font-mono ${severityBadge[alert.severity]}`}>
          {alert.severity.toUpperCase()}
        </span>
        {arb?.ai_signal && (
          <span className={`px-[7px] py-[2px] rounded-[4px] text-[9px] font-bold font-mono ${signalBadge[arb.ai_signal]}`}>
            🤖 {arb.ai_signal}
          </span>
        )}
        {!alert.is_read && <span className="w-2 h-2 rounded-full bg-dn shrink-0" />}
        <span className="text-[9px] text-ink-dim font-mono ml-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Summary body */}
      <div className="px-3 py-[9px]">
        {anom && <AnomalyBody alert={anom} />}
        {arb  && <ArbitrageSummary alert={arb} />}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-rule bg-[#fafaf9] px-3 py-[10px] flex flex-col gap-3">
          {arb  && <ArbitrageCalcBreakdown alert={arb} />}
          {anom && <AnomalyCalcBreakdown alert={anom} />}
          {arb  && <LogisticsRiskPanel alert={arb} />}
          {arb  && (
            <AIInsightsPanel
              insights={arb.insights}
              recommendedActions={arb.recommended_actions}
              riskFactors={arb.risk_factors}
            />
          )}
          <div className="font-mono text-[9px] text-ink-dim text-right">
            {new Date(alert.created_at).toLocaleString("id-ID")}
          </div>
        </div>
      )}
    </div>
  );
}

export type { Alert };
