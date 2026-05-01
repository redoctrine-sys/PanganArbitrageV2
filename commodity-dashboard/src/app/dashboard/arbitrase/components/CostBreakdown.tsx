"use client";

import { formatRupiah } from "@/lib/analytics/metrics";
import type { ArbitraseCalcResult } from "../types/arbitrase";

interface Props {
  result: ArbitraseCalcResult;
}

export function CostBreakdown({ result }: Props) {
  const vol = result.volumeKg;

  return (
    <div className="border border-rule rounded-[10px] overflow-hidden bg-paper">
      <div className="px-4 py-[10px] bg-paper-3 border-b border-rule text-[9px] font-bold uppercase tracking-[0.9px] text-ink-dim font-mono">
        Rincian Biaya
      </div>

      <table className="preview-table m-0">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Per kg</th>
            <th className="text-right">{`Total (${vol.toLocaleString("id-ID")} kg)`}</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Harga beli" perUnit={result.priceSource} total={result.priceSource * vol} />
          <Row label="Biaya transport" perUnit={result.transportCostPerKg} total={result.transportCostPerKg * vol} />
          <Row
            label="Modal total"
            perUnit={result.capitalPerUnit}
            total={result.totalCapital}
            bold
          />
          <Row
            label="Harga jual"
            perUnit={result.priceDest}
            total={result.priceDest * vol}
            colorClass="text-up"
          />
          <Row
            label="Keuntungan bersih"
            perUnit={result.netProfitPerUnit}
            total={result.totalProfit}
            bold
            colorClass={result.isProfitable ? "text-up" : "text-dn"}
          />
        </tbody>
      </table>

      <div className="px-4 py-[10px] bg-paper-2 border-t border-rule flex gap-[20px] text-[11px] font-mono">
        <span className="text-ink-dim">
          Selisih harga:{" "}
          <b className={result.priceDiff > 0 ? "text-up" : "text-dn"}>
            {formatRupiah(result.priceDiff)}/kg
          </b>
        </span>
        <span className="text-ink-dim">
          Break-even transport:{" "}
          <b className="text-ink">
            {formatRupiah(result.priceDiff > 0 ? result.priceDiff : 0)}/kg
          </b>
        </span>
      </div>
    </div>
  );
}

function Row({
  label, perUnit, total, bold, colorClass,
}: {
  label: string;
  perUnit: number;
  total: number;
  bold?: boolean;
  colorClass?: string;
}) {
  const cls = `font-mono ${bold ? "font-bold" : "font-normal"} ${colorClass ?? "text-ink"} text-right`;
  return (
    <tr>
      <td className={`${bold ? "font-bold" : "font-normal"} ${colorClass ?? "text-ink"}`}>{label}</td>
      <td className={cls}>{formatRupiah(perUnit)}</td>
      <td className={cls}>{formatRupiah(total)}</td>
    </tr>
  );
}
