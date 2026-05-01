"use client";

import type { AddRouteFormState } from "../types/vendor";

const VEHICLE_OPTIONS = [
  { value: "pickup", label: "Pickup" },
  { value: "engkel", label: "Engkel" },
  { value: "truk", label: "Truk" },
  { value: "kontainer", label: "Kontainer" },
];

const INPUT_STYLE: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 6,
  border: "1px solid var(--rule)",
  background: "var(--paper)",
  fontSize: 12,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

interface Props {
  form: AddRouteFormState;
  onPatch: (patch: Partial<AddRouteFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddRouteForm({ form, onPatch, onSubmit, onCancel }: Props) {
  const isValid = form.fromCity.trim() && form.toCity.trim() && Number(form.costPerKg) > 0;

  return (
    <div
      style={{
        background: "var(--paper2)",
        border: "1px solid var(--rule)",
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mid)", marginBottom: 14 }}>
        Tambah Rute Transport
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="Kota Asal">
          <input
            style={INPUT_STYLE}
            placeholder="mis. Jakarta Pusat"
            value={form.fromCity}
            onChange={(e) => onPatch({ fromCity: e.target.value })}
          />
        </Field>
        <Field label="Kota Tujuan">
          <input
            style={INPUT_STYLE}
            placeholder="mis. Kab. Bogor"
            value={form.toCity}
            onChange={(e) => onPatch({ toCity: e.target.value })}
          />
        </Field>
        <Field label="Kendaraan">
          <select
            style={INPUT_STYLE}
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
            style={{ ...INPUT_STYLE, fontFamily: "var(--font-mono)" }}
            placeholder="mis. 500"
            value={form.costPerKg}
            min={0}
            onChange={(e) => onPatch({ costPerKg: e.target.value })}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
        <Field label="Jarak (km, opsional)">
          <input
            type="number"
            style={{ ...INPUT_STYLE, fontFamily: "var(--font-mono)" }}
            placeholder="mis. 60"
            value={form.distanceKm}
            min={0}
            onChange={(e) => onPatch({ distanceKm: e.target.value })}
          />
        </Field>
        <Field label="Catatan">
          <input
            style={INPUT_STYLE}
            placeholder="mis. via Tol Jagorawi, armada 1 ton"
            value={form.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
      <div
        style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
          letterSpacing: "0.9px", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", marginBottom: 5,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
