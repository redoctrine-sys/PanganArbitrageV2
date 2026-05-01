"use client";

import type { AddRouteFormState } from "../types/vendor";

const VEHICLE_OPTIONS = [
  { value: "pickup", label: "Pickup" },
  { value: "engkel", label: "Engkel" },
  { value: "truk", label: "Truk" },
  { value: "kontainer", label: "Kontainer" },
];

const INPUT_CLASS =
  "w-full px-[9px] py-[6px] rounded-[6px] border border-rule bg-paper text-[12px] text-ink outline-none";

interface Props {
  form: AddRouteFormState;
  onPatch: (patch: Partial<AddRouteFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddRouteForm({ form, onPatch, onSubmit, onCancel }: Props) {
  const isValid = form.fromCity.trim() && form.toCity.trim() && Number(form.costPerKg) > 0;

  return (
    <div className="bg-paper-2 border border-rule rounded-[10px] px-[18px] py-4">
      <div className="text-[11px] font-semibold text-ink-mid mb-[14px]">
        Tambah Rute Transport
      </div>

      <div className="grid grid-cols-4 gap-[12px] mb-3">
        <Field label="Kota Asal">
          <input
            className={INPUT_CLASS}
            placeholder="mis. Jakarta Pusat"
            value={form.fromCity}
            onChange={(e) => onPatch({ fromCity: e.target.value })}
          />
        </Field>
        <Field label="Kota Tujuan">
          <input
            className={INPUT_CLASS}
            placeholder="mis. Kab. Bogor"
            value={form.toCity}
            onChange={(e) => onPatch({ toCity: e.target.value })}
          />
        </Field>
        <Field label="Kendaraan">
          <select
            className={INPUT_CLASS}
            value={form.vehicleType}
            onChange={(e) => onPatch({ vehicleType: e.target.value as AddRouteFormState["vehicleType"] })}
          >
            {VEHICLE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Biaya/kg (Rp)">
          <input
            type="number"
            className={`${INPUT_CLASS} font-mono`}
            placeholder="mis. 500"
            value={form.costPerKg}
            min={0}
            onChange={(e) => onPatch({ costPerKg: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-[12px] mb-[14px]">
        <Field label="Jarak (km, opsional)">
          <input
            type="number"
            className={`${INPUT_CLASS} font-mono`}
            placeholder="mis. 60"
            value={form.distanceKm}
            min={0}
            onChange={(e) => onPatch({ distanceKm: e.target.value })}
          />
        </Field>
        <Field label="Catatan">
          <input
            className={INPUT_CLASS}
            placeholder="mis. via Tol Jagorawi, armada 1 ton"
            value={form.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Batal</button>
        <button
          type="button"
          className="btn btn-green"
          disabled={!isValid}
          onClick={onSubmit}
        >
          Simpan Rute
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.9px] text-ink-dim font-mono mb-[5px]">
        {label}
      </div>
      {children}
    </div>
  );
}
