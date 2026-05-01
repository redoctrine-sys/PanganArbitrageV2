"use client";

import { useArbitraseCalc } from "./hooks/useArbitraseCalc";
import { CommodityCitySelector } from "./components/CommodityCitySelector";
import { ArbitraseResult } from "./components/ArbitraseResult";
import { CostBreakdown } from "./components/CostBreakdown";

export default function ArbitrasePage() {
  const { loading, error, input, patchInput, commodities, citiesForCommodity, result } =
    useArbitraseCalc();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-1">
          <div className="w-1 h-[22px] rounded-[3px] bg-arb shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">
              Arbitrase — Manual Kalkulator
            </div>
            <div className="font-mono text-[10px] text-ink-dim">
              Hitung potensi keuntungan arbitrase antar kota · Data harga dari SP2KP
            </div>
          </div>
          <span className="pill ml-auto bg-hi-bg text-arb text-[9px]">
            Phase 2
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-[14px]">
        {loading && (
          <div className="empty">
            <div className="empty-title">Memuat data harga SP2KP...</div>
          </div>
        )}

        {!loading && error && (
          <div className="anom-bar danger">{error}</div>
        )}

        {!loading && !error && (
          <>
            <CommodityCitySelector
              input={input}
              commodities={commodities}
              cities={citiesForCommodity}
              onPatch={patchInput}
            />

            {!result && (
              <div className="empty py-10 px-5">
                <div className="empty-title">Pilih komoditas dan dua kota untuk kalkulasi</div>
                <div className="empty-sub">
                  Kalkulator akan otomatis menghitung potensi keuntungan berdasarkan harga SP2KP terkini.
                </div>
              </div>
            )}

            {result && (
              <>
                <ArbitraseResult result={result} />
                <CostBreakdown result={result} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
