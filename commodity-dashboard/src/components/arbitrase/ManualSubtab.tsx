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

function SummaryCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.9px] mb-[3px]" style={{ color: "rgba(245,241,234,.4)" }}>
        {label}
      </div>
      <div className="font-mono text-[15px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export function ManualSubtab({ legs, vendors, legResults, chainSummary, onUpdateLeg, onRemoveLeg, onAddLeg }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-[16px_18px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-serif text-[14px] font-bold">Manual Arbitrase Calculator</div>
          <div className="font-mono text-[10px] text-ink-dim mt-[2px]">
            Multi-leg bebas · Vendor dari DB · Harga manual atau ambil dari SP2KP (Phase 2)
          </div>
        </div>
      </div>

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

      {/* Add leg button */}
      <button
        type="button"
        onClick={onAddLeg}
        className="w-full p-[10px] border-2 border-dashed border-rule rounded-lg bg-transparent text-[12px] font-medium text-ink-dim cursor-pointer mb-[14px] transition-all duration-150 hover:border-arb hover:text-arb hover:bg-[#ffedd5]"
      >
        + Tambah Leg Baru
      </button>

      {/* Chain summary */}
      {chainSummary && (
        <div className="bg-ink rounded-lg p-[14px_16px] text-paper">
          <div className="font-serif text-[14px] font-bold mb-[10px]">
            📊 Chain Summary — {legs.length} Leg
          </div>
          <div className="grid grid-cols-4 gap-2 mb-[10px]">
            <SummaryCell label="Total Modal"     value={fmtRp(chainSummary.totalModal)}     color="#fcd34d" />
            <SummaryCell label="Total Transport" value={fmtRp(chainSummary.totalTransport)} color="rgba(245,241,234,.55)" />
            <SummaryCell label="Net Profit"      value={fmtRp(chainSummary.totalNet)}       color={chainSummary.totalNet >= 0 ? "#6ee7a0" : "#fca5a5"} />
            <SummaryCell label="ROI Chain"       value={fmtPct(chainSummary.roi)}           color={chainSummary.roi >= 0 ? "#6ee7a0" : "#fca5a5"} />
          </div>
          <div className="border-t border-[rgba(245,241,234,.1)] pt-[9px] flex gap-[7px] items-center">
            {chainSummary.totalNet >= 0 ? (
              <span className="px-2 py-[3px] rounded-[5px] text-[10px] font-mono font-semibold bg-[rgba(110,231,160,.12)] text-[#6ee7a0] border border-[rgba(110,231,160,.25)]">
                ✓ Viable
              </span>
            ) : (
              <span className="px-2 py-[3px] rounded-[5px] text-[10px] font-mono font-semibold bg-[rgba(252,100,100,.12)] text-[#fca5a5] border border-[rgba(252,100,100,.25)]">
                ✗ Rugi
              </span>
            )}
            <span className="font-mono text-[10px] ml-auto" style={{ color: "rgba(245,241,234,.35)" }}>
              Harga manual · Vendor transport DB ✓
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
