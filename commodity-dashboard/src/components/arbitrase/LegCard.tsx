"use client";

import { fmtRp, fmtPct, calcTransportPerTrip, COMMODITIES, type Leg, type LegResult, type Vendor } from "./arbitrase.types";

const inputCls = "w-full px-2 py-[6px] border border-rule rounded-[6px] text-[11px] font-sans bg-paper-2 text-ink outline-none";
const selectCls = "w-full px-2 py-[6px] border border-rule rounded-[6px] text-[11px] font-sans bg-paper-2 text-ink outline-none";

function LgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold uppercase tracking-[0.9px] text-ink-dim font-mono">{label}</label>
      {children}
    </div>
  );
}

function LrCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.8px] text-ink-dim font-mono mb-[2px]">{label}</div>
      <div className="font-mono text-[12px] font-bold" style={{ color: color ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

interface Props {
  leg: Leg;
  index: number;
  vendors: Vendor[];
  result: LegResult | null;
  canRemove: boolean;
  onUpdate: (patch: Partial<Leg>) => void;
  onRemove: () => void;
}

export function LegCard({ leg, index, vendors, result, canRemove, onUpdate, onRemove }: Props) {
  const selectedVendor = vendors.find((v) => v.id === leg.vendorId) ?? null;
  const km = Number(leg.jarakKm);
  const validKm = isFinite(km) && km > 0;
  const transportPerTrip = selectedVendor ? calcTransportPerTrip(selectedVendor, validKm ? km : 0) : null;
  const routeLabel = leg.kotaBeli && leg.kotaJual ? `${leg.kotaBeli} → ${leg.kotaJual}` : `Leg ${index + 1}`;

  return (
    <div className="bg-white border border-rule rounded-lg mb-[10px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-[9px] px-[13px] py-[9px] bg-paper-2 border-b border-rule">
        <div className="w-[21px] h-[21px] rounded-full bg-ink text-paper text-[11px] font-bold font-mono flex items-center justify-center shrink-0">
          {index + 1}
        </div>
        <div className="font-serif text-[12px] font-semibold flex-1">
          Leg {index + 1} — {routeLabel}
        </div>
        {result && (
          <span className={`font-mono text-[11px] font-bold ${result.roi >= 0 ? "text-up" : "text-dn"}`}>
            ROI {fmtPct(result.roi)}
          </span>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="px-2 py-[3px] bg-dn-bg text-dn border border-[#fecaca] rounded-[5px] text-[10px] cursor-pointer">
            Hapus
          </button>
        )}
      </div>

      {/* Input grid */}
      <div className="grid grid-cols-3 gap-[9px] p-[11px_13px] border-b border-rule">
        <LgField label="Komoditas">
          <select value={leg.commodity} onChange={(e) => onUpdate({ commodity: e.target.value })} className={selectCls}>
            {COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </LgField>
        <LgField label="Kota Beli">
          <input type="text" value={leg.kotaBeli} onChange={(e) => onUpdate({ kotaBeli: e.target.value })}
            placeholder="Yogyakarta" className={inputCls} />
        </LgField>
        <LgField label="Kota Jual">
          <input type="text" value={leg.kotaJual} onChange={(e) => onUpdate({ kotaJual: e.target.value })}
            placeholder="Denpasar" className={inputCls} />
        </LgField>

        <LgField label="Harga Beli (Rp/kg)">
          <div className="relative">
            <input type="number" min={0} value={leg.hargaBeli}
              onChange={(e) => onUpdate({ hargaBeli: e.target.value })}
              placeholder="44500" className={`${inputCls} pr-9 font-mono`} />
            <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[8px] font-mono text-sp font-bold pointer-events-none">/kg</span>
          </div>
        </LgField>
        <LgField label="Harga Jual (Rp/kg)">
          <div className="relative">
            <input type="number" min={0} value={leg.hargaJual}
              onChange={(e) => onUpdate({ hargaJual: e.target.value })}
              placeholder="72000" className={`${inputCls} pr-9 font-mono`} />
            <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[8px] font-mono text-dn font-bold pointer-events-none">/kg</span>
          </div>
        </LgField>
        <LgField label="Volume (kg)">
          <input type="number" min={1} value={leg.volumeKg}
            onChange={(e) => onUpdate({ volumeKg: e.target.value })}
            placeholder="1000" className={`${inputCls} font-mono`} />
        </LgField>

        <div className="col-span-2">
          <LgField label="Vendor Transport">
            <select value={leg.vendorId} onChange={(e) => onUpdate({ vendorId: e.target.value })} className={selectCls}>
              <option value="">— Pilih vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.pricing_type === "per_km"
                    ? `Rp ${v.price.toLocaleString("id-ID")}/km`
                    : `Flat Rp ${v.price.toLocaleString("id-ID")}`}
                  {v.capacity_kg ? ` · ${v.capacity_kg.toLocaleString("id-ID")} kg` : ""}
                </option>
              ))}
            </select>
          </LgField>
        </div>
        <LgField label={selectedVendor?.pricing_type === "per_km" ? "Jarak (km)" : "Trips"}>
          {selectedVendor?.pricing_type === "per_km" ? (
            <input type="number" min={0} value={leg.jarakKm}
              onChange={(e) => onUpdate({ jarakKm: e.target.value })}
              placeholder="312" className={`${inputCls} font-mono`} />
          ) : (
            <input value={result ? `${result.trips} trip` : "1 trip"} readOnly
              className={`${inputCls} bg-paper-3 text-ink-dim`} />
          )}
        </LgField>
      </div>

      {/* Transport info row */}
      {(selectedVendor || validKm) && (
        <div className="px-[13px] py-[7px] bg-[#f7f5f0] border-b border-rule flex gap-4 flex-wrap text-[10px] font-mono text-ink-mid">
          {selectedVendor?.pricing_type === "per_km" && validKm && (
            <span>🗺 Jarak: <span className="text-ink font-medium">{km.toLocaleString("id-ID")} km</span></span>
          )}
          {selectedVendor && transportPerTrip != null && (
            <span>💰 Transport/trip: <span className="text-ink font-medium">{fmtRp(transportPerTrip)}</span></span>
          )}
          {result && result.trips > 1 && (
            <span>🚛 Trips: <span className="text-ink font-medium">{result.trips}×</span></span>
          )}
          {result && result.transportCost > 0 && (
            <span>💸 Total: <span className="text-arb font-medium">{fmtRp(result.transportCost)}</span></span>
          )}
          {selectedVendor?.base_fare_rp != null && selectedVendor.pricing_type === "per_km" && (
            <span>⚡ Dasar: <span className="text-ink font-medium">Rp {selectedVendor.base_fare_rp.toLocaleString("id-ID")} / {selectedVendor.base_km} km</span></span>
          )}
        </div>
      )}

      {/* Result row */}
      {result ? (
        <div className="p-[10px_13px] grid grid-cols-4 gap-[7px]">
          <LrCell label="Pendapatan"    value={fmtRp(result.revenue)} />
          <LrCell label="Modal Beli"    value={fmtRp(result.modalBeli)} />
          <LrCell label="Biaya Transport" value={fmtRp(result.transportCost)} color="var(--arb)" />
          <LrCell label="Net Profit"    value={fmtRp(result.netProfit)} color={result.netProfit >= 0 ? "var(--up)" : "var(--dn)"} />
        </div>
      ) : (
        <div className="p-[10px_13px]">
          <div className="text-[10px] text-ink-dim font-mono">
            Isi harga beli, harga jual, dan volume untuk melihat hasil kalkulasi.
          </div>
        </div>
      )}
    </div>
  );
}
