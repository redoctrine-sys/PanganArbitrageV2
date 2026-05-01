"use client";

import { useState } from "react";
import { fmtRp } from "@/components/arbitrase/arbitrase.types";

interface TransportOption {
  vendor_name: string;
  capacity_kg: number;
  cost: number;
  profit: number;
  roi: number;
  breakdown: string;
}

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
  distance_km?: number;
  transport_detail?: string;
  // Logistics risk fields
  eta_hours?: number;
  volatility_pct?: number;
  volatility_label?: string;
  spread_duration?: string;
  logistic_risk?: string;
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

function CalcRow({ label, value, highlight, dimmed, borderTop }: {
  label: string; value: React.ReactNode;
  highlight?: boolean; dimmed?: boolean; borderTop?: boolean;
}) {
  return (
    <div className={`flex justify-between text-[10px] font-mono py-[3px] ${borderTop ? "border-t border-rule mt-[2px] pt-[5px]" : ""}`}>
      <span className={dimmed ? "text-ink-dim" : "text-ink-mid"}>{label}</span>
      <span className={`font-semibold ${highlight ? "text-up text-[11px]" : dimmed ? "text-ink-dim" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function fmtEta(hours: number, distanceKm?: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const time = h === 0 ? `~${m} Menit` : m === 0 ? `~${h} Jam` : `~${h} Jam ${m} Menit`;
  const hasFerry = distanceKm != null && hours > distanceKm / 40 + 1;
  return hasFerry ? `${time} (Darat + Feri)` : `${time} (Darat)`;
}

function parseTransportOptions(raw: string | undefined): TransportOption[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AlertCard({ alert, onRead }: { alert: Alert; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isAnomaly   = alert.type === "anomaly";
  const isArbitrage = alert.type === "arbitrage";

  const borderColor = isArbitrage ? "border-l-[#16a34a]" : "border-l-dn";
  const borderCls   = alert.is_read
    ? "border-rule"
    : `border-l-[3px] ${borderColor} border-rule`;
  const headerBg    = isArbitrage ? "bg-[#f0fdf4]" : "bg-paper-2";

  function handleClick() {
    setExpanded((v) => !v);
    if (!alert.is_read) onRead(alert.id);
  }

  // Derived calculations for detail panel
  const vol        = alert.volume_kg ?? 1000;
  const modalBeli  = alert.price_buy  != null ? alert.price_buy  * vol : null;
  const hasilJual  = alert.price_sell != null ? alert.price_sell * vol : null;
  const grossProfit= modalBeli != null && hasilJual != null ? hasilJual - modalBeli : null;
  const netProfit  = grossProfit != null && alert.transport_cost != null ? grossProfit - alert.transport_cost : null;
  const roi        = netProfit != null && modalBeli != null && modalBeli > 0
    ? (netProfit / modalBeli) * 100 : null;

  const hetSelisih = alert.price != null && alert.het_ha != null ? alert.price - alert.het_ha : null;

  // Parse transport options (JSON array stored in transport_detail)
  const transportOptions = parseTransportOptions(alert.transport_detail);
  const bestOption = transportOptions[0] ?? null;

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden cursor-pointer transition-opacity ${borderCls} ${alert.is_read ? "opacity-70" : ""}`}
      onClick={handleClick}
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
        <span className="text-[9px] text-ink-dim font-mono ml-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Summary body — always visible */}
      <div className="px-3 py-[9px]">
        {isAnomaly && (
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Kota"        value={alert.city_name ?? "—"} />
            <Row label="Harga"       value={alert.price != null ? fmtRp(alert.price) : "—"} />
            <Row label="HET"         value={alert.het_ha != null ? fmtRp(alert.het_ha) : "—"} />
            <Row label="Di atas HET" value={<span className="text-dn">+{alert.excess_percent?.toFixed(1)}%</span>} />
          </div>
        )}

        {isArbitrage && (
          <>
            <div className="flex items-center gap-2 mb-[6px] text-[11px]">
              <span className="font-mono font-semibold text-ink">{alert.city_from ?? "—"}</span>
              <span className="text-ink-dim">→</span>
              <span className="font-mono font-semibold text-ink">{alert.city_to ?? "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <Row label="Harga Beli"  value={alert.price_buy  != null ? fmtRp(alert.price_buy)  : "—"} />
              <Row label="Harga Jual"  value={alert.price_sell != null ? fmtRp(alert.price_sell) : "—"} />
              <Row label="Spread"      value={<span className="text-up">{alert.spread_percent?.toFixed(1)}%</span>} />
              <Row label="Transport"   value={alert.transport_cost != null ? fmtRp(alert.transport_cost) : "—"} />
              <Row label="Volume"      value={`${vol.toLocaleString()} kg`} />
              <Row label="Est. Profit" value={
                <span className="flex items-center gap-1">
                  <span className={alert.profit_estimate != null && alert.profit_estimate >= 0 ? "text-up font-bold" : "text-dn font-bold"}>
                    {alert.profit_estimate != null ? fmtRp(alert.profit_estimate) : "—"}
                  </span>
                  {bestOption != null && (
                    <span className="text-up text-[9px]">({bestOption.roi.toFixed(1)}% ROI)</span>
                  )}
                </span>
              } />
            </div>
            {alert.vendor_name && (
              <div className="text-[9px] font-mono text-ink-dim mt-1">🚛 Via: {alert.vendor_name}</div>
            )}
          </>
        )}
      </div>

      {/* Detail panel — visible when expanded */}
      {expanded && (
        <div className="border-t border-rule bg-[#fafaf9] px-3 py-[10px] flex flex-col gap-3">

          {/* ── Arbitrage calculation breakdown ── */}
          {isArbitrage && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
                📊 Rincian Perhitungan
              </div>
              <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
                <CalcRow
                  label={`Modal Beli (${vol.toLocaleString()} kg × ${alert.price_buy != null ? fmtRp(alert.price_buy) : "—"})`}
                  value={modalBeli != null ? fmtRp(modalBeli) : "—"}
                  dimmed
                />
                <CalcRow
                  label={`Hasil Jual (${vol.toLocaleString()} kg × ${alert.price_sell != null ? fmtRp(alert.price_sell) : "—"})`}
                  value={hasilJual != null ? fmtRp(hasilJual) : "—"}
                  dimmed
                />
                <CalcRow
                  label="Gross Profit (Jual − Beli)"
                  value={grossProfit != null ? fmtRp(grossProfit) : "—"}
                  borderTop
                />
                <CalcRow
                  label={`Biaya Transport${alert.vendor_name ? ` (${alert.vendor_name})` : ""}`}
                  value={alert.transport_cost != null ? `− ${fmtRp(alert.transport_cost)}` : "—"}
                />

                {/* Transport options accordion */}
                {transportOptions.length > 0 && (
                  <div className="mt-[6px] mb-[4px] flex flex-col gap-[3px]">
                    {transportOptions.map((opt, idx) => (
                      <details
                        key={idx}
                        className="text-[10px] rounded border border-rule overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <summary className="cursor-pointer font-mono px-2 py-[4px] bg-paper-2 hover:bg-rule select-none flex items-center gap-1">
                          <span className="text-ink-dim shrink-0">Opsi {idx + 1}:</span>
                          <span className="font-semibold text-ink flex-1">{opt.vendor_name} ({opt.capacity_kg.toLocaleString()}kg)</span>
                          <span className="text-ink shrink-0">{fmtRp(opt.cost)}</span>
                          <span className={`shrink-0 ml-1 font-bold ${opt.roi >= 0 ? "text-up" : "text-dn"}`}>
                            {opt.roi.toFixed(1)}% ROI
                          </span>
                        </summary>
                        <div className="px-3 py-[6px] bg-white font-mono flex flex-col gap-[3px]">
                          <div className="text-ink-dim">{opt.breakdown}</div>
                          <div className="flex justify-between pt-[3px] border-t border-rule mt-[2px]">
                            <span className="text-ink-mid">Net Profit ({opt.capacity_kg.toLocaleString()} kg)</span>
                            <span className={`font-semibold ${opt.profit >= 0 ? "text-up" : "text-dn"}`}>{fmtRp(opt.profit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-mid">ROI</span>
                            <span className={`font-semibold ${opt.roi >= 0 ? "text-up" : "text-dn"}`}>{opt.roi.toFixed(2)}%</span>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                <CalcRow
                  label="NET PROFIT"
                  value={netProfit != null ? fmtRp(netProfit) : "—"}
                  highlight
                  borderTop
                />
                {roi != null && (
                  <CalcRow
                    label="ROI"
                    value={<span className={roi >= 0 ? "text-up" : "text-dn"}>{roi.toFixed(2)}%</span>}
                  />
                )}
                {alert.ai_confidence != null && (
                  <CalcRow
                    label="Confidence AI"
                    value={`${Math.round(alert.ai_confidence * 100)}%`}
                    dimmed
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Anomaly calculation breakdown ── */}
          {isAnomaly && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
                📊 Rincian Perhitungan
              </div>
              <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
                <CalcRow label="Harga Pasar"  value={alert.price  != null ? fmtRp(alert.price)  : "—"} dimmed />
                <CalcRow label="HET (batas)"  value={alert.het_ha != null ? fmtRp(alert.het_ha) : "—"} dimmed />
                <CalcRow
                  label="Selisih (Harga − HET)"
                  value={hetSelisih != null ? fmtRp(hetSelisih) : "—"}
                  borderTop
                />
                <CalcRow
                  label="Kelebihan %"
                  value={<span className="text-dn">+{alert.excess_percent?.toFixed(2)}%</span>}
                  highlight
                />
              </div>
            </div>
          )}

          {/* ── Logistics Risk Analysis ── */}
          {isArbitrage && (alert.eta_hours != null || alert.volatility_pct != null) && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
                🚛 Analisis Risiko Logistik
              </div>
              <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
                {alert.eta_hours != null && (
                  <CalcRow
                    label="Estimasi Perjalanan"
                    value={fmtEta(alert.eta_hours, alert.distance_km)}
                    dimmed
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
                  <CalcRow
                    label="Status Spread"
                    value={alert.spread_duration}
                    dimmed
                  />
                )}
                {alert.logistic_risk && (
                  <div className="text-[10px] font-mono mt-[6px] p-2 bg-[#fee2e2] text-[#991b1b] rounded border border-[#fecaca] leading-[1.5]">
                    {alert.logistic_risk}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AI Insights ── */}
          {isArbitrage && alert.insights && alert.insights.length > 0 && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">🤖 AI Insight</div>
              <div className="flex flex-col gap-[3px]">
                {alert.insights.map((s, i) => (
                  <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">· {s}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recommended actions ── */}
          {isArbitrage && alert.recommended_actions && alert.recommended_actions.length > 0 && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">📋 Rekomendasi</div>
              <div className="flex flex-col gap-[3px]">
                {alert.recommended_actions.map((s, i) => (
                  <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">→ {s}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Risk factors ── */}
          {isArbitrage && alert.risk_factors && alert.risk_factors.length > 0 && (
            <div>
              <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">⚠ Risiko</div>
              <div className="flex flex-col gap-[3px]">
                {alert.risk_factors.map((s, i) => (
                  <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">! {s}</div>
                ))}
              </div>
            </div>
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
