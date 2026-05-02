"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";
import type { AnomalyAlertUI } from "./alert-card.types";
import { Row, CalcRow } from "./alert-card.utils";

export function AnomalyBody({ alert }: { alert: AnomalyAlertUI }) {
  return (
    <div className="grid grid-cols-2 gap-x-4">
      <Row label="Kota"        value={alert.city_name} />
      <Row label="Harga"       value={fmtRp(alert.price)} />
      <Row label="HET"         value={fmtRp(alert.het_ha)} />
      <Row label="Di atas HET" value={<span className="text-dn">+{alert.excess_percent.toFixed(1)}%</span>} />
    </div>
  );
}

export function AnomalyCalcBreakdown({ alert }: { alert: AnomalyAlertUI }) {
  const hetSelisih = alert.price - alert.het_ha;
  return (
    <div>
      <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">
        📊 Rincian Perhitungan
      </div>
      <div className="bg-white border border-rule rounded-md px-3 py-[8px]">
        <CalcRow label="Harga Pasar"  value={fmtRp(alert.price)}  dimmed />
        <CalcRow label="HET (batas)"  value={fmtRp(alert.het_ha)} dimmed />
        <CalcRow label="Selisih (Harga − HET)" value={fmtRp(hetSelisih)} borderTop />
        <CalcRow
          label="Kelebihan %"
          value={<span className="text-dn">+{alert.excess_percent.toFixed(2)}%</span>}
          highlight
        />
      </div>
    </div>
  );
}
