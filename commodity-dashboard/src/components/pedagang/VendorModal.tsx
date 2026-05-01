"use client";

import { useState } from "react";
import { type Moda, type PricingType, type Vendor } from "./vendor.types";

interface Props {
  initial?: Vendor;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Vendor, "id">>) => Promise<void>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold tracking-[0.9px] uppercase text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-[10px] py-[6px] rounded-[6px] border border-rule bg-paper text-[12px] text-ink outline-none";

export function VendorModal({ initial, onClose, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [moda, setModa] = useState<Moda>(initial?.moda ?? "truk");
  const [pricingType, setPricingType] = useState<PricingType>(initial?.pricing_type ?? "per_km");
  const [priceStr, setPriceStr] = useState(initial?.price != null ? String(initial.price) : "");
  const [capStr, setCapStr] = useState(initial?.capacity_kg != null ? String(initial.capacity_kg) : "");
  const [baseFareStr, setBaseFareStr] = useState(initial?.base_fare_rp != null ? String(initial.base_fare_rp) : "");
  const [baseKmStr, setBaseKmStr] = useState(initial?.base_km != null ? String(initial.base_km) : "");
  const [coverage, setCoverage] = useState(initial?.coverage ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!initial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr("Nama vendor wajib diisi"); return; }
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) { setErr("Harga harus angka positif"); return; }
    const capacity_kg = capStr.trim() ? Number(capStr) : null;
    if (capStr.trim() && !Number.isFinite(capacity_kg as number)) { setErr("Kapasitas harus angka"); return; }
    const base_fare_rp = baseFareStr.trim() ? Number(baseFareStr) : null;
    if (baseFareStr.trim() && !Number.isFinite(base_fare_rp as number)) { setErr("Tarif dasar harus angka"); return; }
    const base_km = baseKmStr.trim() ? Number(baseKmStr) : null;
    if (baseKmStr.trim() && !Number.isFinite(base_km as number)) { setErr("Jarak dasar harus angka"); return; }

    setBusy(true);
    try {
      await onSave({
        name: name.trim(), moda, pricing_type: pricingType, price,
        capacity_kg, base_fare_rp, base_km,
        coverage: coverage.trim() || null,
        contact: contact.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-hd">
          <div>
            <div className="font-serif text-[14px] font-bold">
              {isEdit ? "Edit Vendor" : "Tambah Vendor Transport"}
            </div>
            {isEdit && <div className="font-mono text-[10px] text-ink-dim mt-[2px]">{initial?.name}</div>}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="modal-bd flex flex-col gap-3">
            <Field label="Nama Vendor">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
                placeholder="Truk Pak Budi, Kapal Feri..." className={`${inputCls} font-sans`} />
            </Field>

            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Moda">
                <select value={moda} onChange={(e) => setModa(e.target.value as Moda)} disabled={busy} className={`${inputCls} font-sans`}>
                  <option value="truk">🚛 Truk</option>
                  <option value="pickup">🛻 Pickup</option>
                  <option value="kapal">⛴ Kapal</option>
                  <option value="motor">🏍 Motor</option>
                  <option value="mobil">🚗 Mobil</option>
                  <option value="lainnya">📦 Lainnya</option>
                </select>
              </Field>
              <Field label="Tipe Harga">
                <select value={pricingType} onChange={(e) => setPricingType(e.target.value as PricingType)} disabled={busy} className={`${inputCls} font-sans`}>
                  <option value="per_km">Per km (Rp/km)</option>
                  <option value="flat_per_trip">Flat per trip</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <Field label={pricingType === "per_km" ? "Harga (Rp/km)" : "Harga Flat (Rp/trip)"}>
                <input type="number" min={0} value={priceStr} onChange={(e) => setPriceStr(e.target.value)}
                  disabled={busy} placeholder={pricingType === "per_km" ? "2000" : "2500000"} className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Kapasitas (kg)">
                <input type="number" min={0} value={capStr} onChange={(e) => setCapStr(e.target.value)}
                  disabled={busy} placeholder="8000" className={`${inputCls} font-mono`} />
              </Field>
            </div>

            {pricingType === "per_km" && (
              <div className="grid grid-cols-2 gap-[10px]">
                <Field label="Tarif Dasar (Rp)">
                  <input type="number" min={0} value={baseFareStr} onChange={(e) => setBaseFareStr(e.target.value)}
                    disabled={busy} placeholder="8000" className={`${inputCls} font-mono`} />
                </Field>
                <Field label="Jarak Dasar (Km)">
                  <input type="number" min={0} step="0.1" value={baseKmStr} onChange={(e) => setBaseKmStr(e.target.value)}
                    disabled={busy} placeholder="3" className={`${inputCls} font-mono`} />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Cakupan Wilayah">
                <input type="text" value={coverage} onChange={(e) => setCoverage(e.target.value)}
                  disabled={busy} placeholder="Jawa · Madura" className={`${inputCls} font-sans`} />
              </Field>
              <Field label="Kontak">
                <input type="text" value={contact} onChange={(e) => setContact(e.target.value)}
                  disabled={busy} placeholder="08xx..." className={`${inputCls} font-sans`} />
              </Field>
            </div>

            <Field label="Catatan (opsional)">
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                disabled={busy} placeholder="Info tambahan, kondisi tarif, dll." className={`${inputCls} font-sans`} />
            </Field>

            {err && (
              <div className="anom-bar danger rounded-[6px] text-[11px]">⚠ <span>{err}</span></div>
            )}
          </div>

          <div className="modal-ft">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" className="btn btn-green" disabled={busy}>
              {busy ? "Menyimpan..." : (isEdit ? "Simpan Perubahan" : "Tambah Vendor")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
