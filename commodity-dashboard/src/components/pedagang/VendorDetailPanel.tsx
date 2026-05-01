"use client";

import { useMemo, useState } from "react";
import { fmtRp, formatPrice, MODA_LABELS, MODA_PILL, type Vendor } from "./vendor.types";

interface Props {
  vendor: Vendor;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-bold tracking-[0.7px] uppercase text-ink-dim mb-1">{label}</div>
      {children}
    </div>
  );
}

export function VendorDetailPanel({ vendor, onClose, onEdit, onDelete }: Props) {
  const [jarakStr, setJarakStr] = useState("");

  const costCalc = useMemo(() => {
    if (vendor.pricing_type !== "per_km") return null;
    const km = parseFloat(jarakStr);
    if (!Number.isFinite(km) || km <= 0) return null;

    let cost: number;
    let breakdown: string;

    if (vendor.base_fare_rp != null && vendor.base_km != null) {
      if (km <= vendor.base_km) {
        cost = vendor.base_fare_rp;
        breakdown = `≤ ${vendor.base_km} km → tarif minimum berlaku`;
      } else {
        const extra = km - vendor.base_km;
        cost = vendor.base_fare_rp + extra * vendor.price;
        breakdown = `${fmtRp(vendor.base_fare_rp)} + ${extra.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km × ${fmtRp(vendor.price)}/km`;
      }
    } else {
      cost = km * vendor.price;
      breakdown = `${km.toLocaleString("id-ID")} km × ${fmtRp(vendor.price)}/km`;
    }

    const costPerKg = vendor.capacity_kg ? Math.round(cost / vendor.capacity_kg) : null;
    return { cost: Math.round(cost), breakdown, costPerKg };
  }, [vendor, jarakStr]);

  return (
    <div className="w-[278px] shrink-0 border-l-2 border-rule bg-paper flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-[14px] pt-[11px] pb-[10px] border-b border-rule bg-[#f0ece4] shrink-0">
        <div className="flex justify-between items-center mb-[5px]">
          <span className={`pill ${MODA_PILL[vendor.moda] ?? "pill-neu"}`}>
            {MODA_LABELS[vendor.moda] ?? vendor.moda}
          </span>
          <button type="button" className="btn btn-ghost px-[7px] py-[2px] text-[11px]" onClick={onClose}>✕</button>
        </div>
        <div className="font-serif text-[13px] font-bold leading-[1.3]">{vendor.name}</div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-[12px_14px] flex flex-col gap-[13px]">
        <DetailSection label="Harga">
          <div className="font-mono text-[15px] font-bold text-ped">{formatPrice(vendor)}</div>
          <div className="font-mono text-[10px] text-ink-dim mt-[1px]">
            {vendor.pricing_type === "per_km" ? "Per kilometer" : "Flat per trip"}
          </div>
          {vendor.base_fare_rp != null && (
            <div className="mt-[7px] p-[7px_9px] bg-paper-3 rounded-[6px]">
              <div className="text-[9px] font-bold tracking-[0.7px] uppercase text-ink-dim mb-[3px]">Tarif Dasar</div>
              <div className="font-mono text-[12px]">
                {fmtRp(vendor.base_fare_rp)}
                {vendor.base_km != null && (
                  <span className="text-ink-dim font-normal"> / {vendor.base_km} km pertama</span>
                )}
              </div>
            </div>
          )}
        </DetailSection>

        {vendor.capacity_kg != null && (
          <DetailSection label="Kapasitas">
            <span className="font-mono text-[13px] font-semibold">
              {vendor.capacity_kg.toLocaleString("id-ID")} kg
            </span>
          </DetailSection>
        )}

        {vendor.pricing_type === "flat_per_trip" && vendor.capacity_kg != null && (
          <DetailSection label="Estimasi Cost/kg (muatan penuh)">
            <span className="font-mono text-[13px] font-semibold text-ped">
              {fmtRp(Math.round(vendor.price / vendor.capacity_kg))}/kg
            </span>
            <div className="text-[9px] text-ink-dim mt-[2px]">
              {fmtRp(vendor.price)} ÷ {vendor.capacity_kg.toLocaleString("id-ID")} kg
            </div>
          </DetailSection>
        )}

        {vendor.coverage && (
          <DetailSection label="Cakupan Wilayah">
            <span className="text-[12px]">{vendor.coverage}</span>
          </DetailSection>
        )}

        {vendor.contact && (
          <DetailSection label="Kontak">
            <span className="text-[12px]">{vendor.contact}</span>
          </DetailSection>
        )}

        {vendor.notes && (
          <DetailSection label="Catatan">
            <span className="text-[11px] text-ink-mid leading-[1.6]">{vendor.notes}</span>
          </DetailSection>
        )}

        {vendor.pricing_type === "per_km" && (
          <div className="p-[10px_11px] bg-paper-3 rounded-lg border border-rule">
            <div className="text-[9px] font-bold tracking-[0.7px] uppercase text-ink-dim mb-2">Estimasi Biaya</div>
            <div className="flex gap-[6px] items-center">
              <input
                type="number" min={0} step="1"
                value={jarakStr}
                onChange={(e) => setJarakStr(e.target.value)}
                placeholder="Jarak km..."
                className="flex-1 px-2 py-[5px] rounded-[6px] border border-rule bg-paper text-[11px] text-ink outline-none font-mono"
              />
              <span className="font-mono text-[10px] text-ink-dim shrink-0">km</span>
            </div>
            {costCalc ? (
              <div className="mt-[9px]">
                <div className="text-[9px] text-ink-dim mb-1 leading-[1.5]">{costCalc.breakdown}</div>
                <div className="font-mono text-[17px] font-bold text-ped">{fmtRp(costCalc.cost)}</div>
                {costCalc.costPerKg != null && (
                  <div className="font-mono text-[10px] text-ink-dim mt-[2px]">
                    ≈ {fmtRp(costCalc.costPerKg)}/kg{" "}
                    <span className="font-sans">(muatan penuh {vendor.capacity_kg?.toLocaleString("id-ID")} kg)</span>
                  </div>
                )}
              </div>
            ) : (
              jarakStr && <div className="text-[10px] text-ink-dim mt-[6px]">Masukkan jarak valid</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-[14px] py-[10px] border-t border-rule flex gap-[6px] shrink-0">
        <button type="button" className="btn btn-ghost flex-1 text-[11px] py-[5px]" onClick={onEdit}>Edit</button>
        <button type="button" className="btn flex-1 text-[11px] py-[5px] bg-dn-bg text-dn border border-[#fecaca]" onClick={onDelete}>Hapus</button>
      </div>
    </div>
  );
}
