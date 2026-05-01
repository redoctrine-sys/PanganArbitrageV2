"use client";

import type { ArbitraseInput, CityOption, CommodityOption } from "../types/arbitrase";

const SEL_STYLE: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 6,
  border: "1px solid var(--rule)",
  background: "var(--paper)",
  fontSize: 12,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

const NUM_STYLE: React.CSSProperties = {
  ...SEL_STYLE,
  fontFamily: "var(--font-mono)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.9px",
  color: "var(--ink-dim)",
  fontFamily: "var(--font-mono)",
  marginBottom: 5,
};

interface Props {
  input: ArbitraseInput;
  commodities: CommodityOption[];
  cities: CityOption[];
  onPatch: (patch: Partial<ArbitraseInput>) => void;
}

export function CommodityCitySelector({ input, commodities, cities, onPatch }: Props) {
  const destCities = cities.filter((c) => c.kode !== input.sourceKode);
  const sourceCities = cities.filter((c) => c.kode !== input.destKode);

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
        Parameter Kalkulasi
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Field label="Komoditas">
          <select
            style={SEL_STYLE}
            value={input.commodityId ?? ""}
            onChange={(e) => onPatch({ commodityId: e.target.value || null, sourceKode: null, destKode: null })}
          >
            <option value="">Pilih komoditas...</option>
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Kota Asal (Beli)">
          <select
            style={SEL_STYLE}
            value={input.sourceKode ?? ""}
            disabled={!input.commodityId}
            onChange={(e) => onPatch({ sourceKode: e.target.value || null })}
          >
            <option value="">Pilih kota asal...</option>
            {sourceCities.map((c) => (
              <option key={c.kode} value={c.kode}>{c.name} · {c.province}</option>
            ))}
          </select>
        </Field>

        <Field label="Kota Tujuan (Jual)">
          <select
            style={SEL_STYLE}
            value={input.destKode ?? ""}
            disabled={!input.commodityId}
            onChange={(e) => onPatch({ destKode: e.target.value || null })}
          >
            <option value="">Pilih kota tujuan...</option>
            {destCities.map((c) => (
              <option key={c.kode} value={c.kode}>{c.name} · {c.province}</option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Biaya Transport (Rp/kg)">
          <input
            type="number"
            style={NUM_STYLE}
            value={input.transportCostPerKg}
            min={0}
            onChange={(e) => onPatch({ transportCostPerKg: Math.max(0, Number(e.target.value)) })}
          />
        </Field>

        <Field label="Volume (kg)">
          <input
            type="number"
            style={NUM_STYLE}
            value={input.volumeKg}
            min={1}
            onChange={(e) => onPatch({ volumeKg: Math.max(1, Number(e.target.value)) })}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={LABEL_STYLE}>{label}</div>
      {children}
    </div>
  );
}
