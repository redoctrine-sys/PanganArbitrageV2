"use client";

import { fmtRp, fmtPct, type Leg, type LegResult, type Vendor } from "./arbitrase.types";
import { LegCard } from "./LegCard";

interface Props {
  legs: Leg[];
  vendors: Vendor[];
  legResults: (LegResult | null)[];
  chainSummary: { totalModal: number; totalTransport: number; totalNet: number; roi: number } | null;
  onUpdateLeg: (id: string, patch: Partial<Leg>) => void;
  onRemoveLeg: (id: string) => void;
  onAddLeg: () => void;
}

function ChainMetric({
  label, value, color, sub,
}: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="font-mono text-[8px] uppercase tracking-[1px]" style={{ color: "rgba(245,241,234,.4)" }}>
        {label}
      </div>
      <div className="font-mono text-[16px] font-bold leading-tight" style={{ color }}>
        {value}
      </div>
      {sub && <div className="font-mono text-[9px]" style={{ color: "rgba(245,241,234,.3)" }}>{sub}</div>}
    </div>
  );
}

export function ManualSubtab({ legs, vendors, legResults, chainSummary, onUpdateLeg, onRemoveLeg, onAddLeg }: Props) {
  const totalLegs = legs.length;
  const calculatedLegs = legResults.filter(Boolean).length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top info bar */}
      <div className="flex items-center gap-3 px-[18px] py-[9px] bg-white border-b border-rule">
        <div className="flex items-center gap-[6px] text-[10px] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
          <span className="text-ink-dim">Multi-leg kalkulator</span>
        </div>
        <div className="w-px h-3 bg-rule" />
        <div className="text-[10px] font-mono text-ink-dim">
          <span className="text-ink font-semibold">{totalLegs}</span> leg ·{" "}
          <span className="text-ink font-semibold">{calculatedLegs}</span> terhitung ·{" "}
          <span className="text-ink font-semibold">{vendors.length}</span> vendor tersedia
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onAddLeg}
            className="btn btn-ghost text-[10px] px-3 py-[5px]"
          >
            + Leg Baru
          </button>
        </div>
      </div>

      {/* Legs + Summary — two column if chain */}
      <div className="p-[14px_18px] flex flex-col gap-[10px]">
        {/* Leg cards */}
        {legs.map((leg, idx) => (
          <LegCard
            key={leg.id}
            leg={leg}
            index={idx}
            vendors={vendors}
            result={legResults[idx]}
            canRemove={legs.length > 1}
            onUpdate={(patch) => onUpdateLeg(leg.id, patch)}
            onRemove={() => onRemoveLeg(leg.id)}
          />
        ))}

        {/* Chain Summary — dark card */}
        {chainSummary && (
          <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,.07)]">
            <div
              className="px-[18px] py-[14px]"
              style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #111 100%)" }}
            >
              <div className="flex items-center gap-2 mb-[14px]">
                <span className="text-[13px]">📊</span>
                <div className="font-serif text-[13px] font-bold text-paper">
                  Chain Summary — {totalLegs} Leg
                </div>
                {chainSummary.totalNet >= 0 ? (
                  <span className="ml-auto px-[8px] py-[3px] rounded-[5px] text-[10px] font-mono font-semibold bg-[rgba(110,231,160,.12)] text-[#6ee7a0] border border-[rgba(110,231,160,.2)]">
                    ✓ Viable
                  </span>
                ) : (
                  <span className="ml-auto px-[8px] py-[3px] rounded-[5px] text-[10px] font-mono font-semibold bg-[rgba(252,100,100,.12)] text-[#fca5a5] border border-[rgba(252,100,100,.2)]">
                    ✗ Merugi
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <ChainMetric label="Total Modal" value={fmtRp(chainSummary.totalModal)} color="#fcd34d" />
                <ChainMetric
                  label="Biaya Transport"
                  value={fmtRp(chainSummary.totalTransport)}
                  color="rgba(245,241,234,.5)"
                  sub={`${((chainSummary.totalTransport / (chainSummary.totalModal || 1)) * 100).toFixed(1)}% dari modal`}
                />
                <ChainMetric
                  label="Net Profit"
                  value={fmtRp(chainSummary.totalNet)}
                  color={chainSummary.totalNet >= 0 ? "#6ee7a0" : "#fca5a5"}
                />
                <ChainMetric
                  label="ROI Chain"
                  value={fmtPct(chainSummary.roi)}
                  color={chainSummary.roi >= 0 ? "#6ee7a0" : "#fca5a5"}
                  sub={chainSummary.roi >= 10 ? "🔥 Profitable" : chainSummary.roi >= 0 ? "Marginal" : "Rugi"}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no result yet */}
        {calculatedLegs === 0 && (
          <div className="empty py-8">
            <div className="text-[26px] mb-2">⚡</div>
            <div className="empty-title">Isi harga beli & jual untuk kalkulasi</div>
            <div className="empty-sub">
              Kalkulator akan menghitung profit, ROI, dan biaya transport secara otomatis.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
