"use client";

import { useEffect, useMemo, useState } from "react";
import { AISubtab } from "./AISubtab";
import { ManualSubtab } from "./ManualSubtab";
import { newLeg, calcTransportPerTrip, type Sub, type Vendor, type Leg, type LegResult } from "./arbitrase.types";

export function ArbitrasePage() {
  const [sub, setSub] = useState<Sub>("manual");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [legs, setLegs] = useState<Leg[]>([newLeg()]);

  useEffect(() => {
    fetch(`/api/transport-vendors?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setVendors((j.data ?? []) as Vendor[]))
      .catch(() => {});
  }, []);

  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLeg(id: string) {
    setLegs((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  const legResults = useMemo<(LegResult | null)[]>(() =>
    legs.map((leg) => {
      const hargaBeli = Number(leg.hargaBeli);
      const hargaJual = Number(leg.hargaJual);
      const volume = Number(leg.volumeKg);
      const km = Number(leg.jarakKm);

      if (!isFinite(hargaBeli) || hargaBeli <= 0) return null;
      if (!isFinite(hargaJual) || hargaJual <= 0) return null;
      if (!isFinite(volume) || volume <= 0) return null;

      const revenue = hargaJual * volume;
      const modalBeli = hargaBeli * volume;
      const vendor = vendors.find((v) => v.id === leg.vendorId) ?? null;

      let transportCost = 0;
      let trips = 1;
      if (vendor) {
        const tpt = calcTransportPerTrip(vendor, isFinite(km) && km > 0 ? km : 0);
        trips = vendor.capacity_kg && vendor.capacity_kg > 0 ? Math.ceil(volume / vendor.capacity_kg) : 1;
        transportCost = tpt * trips;
      }

      const netProfit = revenue - modalBeli - transportCost;
      const roi = modalBeli > 0 ? (netProfit / modalBeli) * 100 : 0;
      return { revenue, modalBeli, transportCost, netProfit, roi, trips, vendor };
    }),
    [legs, vendors]
  );

  const chainSummary = useMemo(() => {
    const valid = legResults.filter(Boolean) as LegResult[];
    if (valid.length === 0) return null;
    const totalModal = valid.reduce((s, r) => s + r.modalBeli, 0);
    const totalTransport = valid.reduce((s, r) => s + r.transportCost, 0);
    const totalNet = valid.reduce((s, r) => s + r.netProfit, 0);
    return { totalModal, totalTransport, totalNet, roi: totalModal > 0 ? (totalNet / totalModal) * 100 : 0 };
  }, [legResults]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pt-3 pb-0 bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-arb shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">Arbitrase</div>
            <div className="font-mono text-[10px] text-ink-dim">
              Transport dari vendor DB · Manual kalkulator multi-leg · AI Suggestion → Phase 2
            </div>
          </div>
        </div>
        <div className="flex gap-[3px]">
          <button type="button" className={`stab ${sub === "ai" ? "active" : ""}`} onClick={() => setSub("ai")}>
            🤖 AI Suggestion{" "}
            <span className="font-mono text-[9px] text-arb bg-[#ffedd5] px-[5px] py-px rounded ml-[3px]">Phase 2</span>
          </button>
          <button type="button" className={`stab ${sub === "manual" ? "active" : ""}`} onClick={() => setSub("manual")}>
            ⚡ Manual Kalkulator
          </button>
        </div>
      </div>

      {sub === "ai" && <AISubtab />}
      {sub === "manual" && (
        <ManualSubtab
          legs={legs} vendors={vendors} legResults={legResults} chainSummary={chainSummary}
          onUpdateLeg={updateLeg} onRemoveLeg={removeLeg}
          onAddLeg={() => setLegs((prev) => [...prev, newLeg()])}
        />
      )}
    </div>
  );
}
