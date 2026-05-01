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
      <div
        style={{
          padding: "12px 18px 9px",
          background: "#f0ece4",
          borderBottom: "2px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center" style={{ gap: 9, marginBottom: 4 }}>
          <div
            style={{ width: 4, height: 22, borderRadius: 3, background: "var(--arb)", flexShrink: 0 }}
          />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>
              Arbitrase — Manual Kalkulator
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Hitung potensi keuntungan arbitrase antar kota · Data harga dari SP2KP
            </div>
          </div>
          <span
            className="pill"
            style={{ marginLeft: "auto", background: "var(--hi-bg)", color: "var(--arb)", fontSize: 9 }}
          >
            Phase 2
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
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
              <div className="empty" style={{ padding: "40px 20px" }}>
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
