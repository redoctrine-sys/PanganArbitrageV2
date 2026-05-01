"use client";

import { formatRupiah } from "@/lib/analytics/metrics";
import type { ArbitraseCalcResult } from "../types/arbitrase";

interface Props {
  result: ArbitraseCalcResult;
}

export function CostBreakdown({ result }: Props) {
  const vol = result.volumeKg;

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          background: "var(--paper3)",
          borderBottom: "1px solid var(--rule)",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.9px",
          color: "var(--ink-dim)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Rincian Biaya
      </div>

      <table className="preview-table" style={{ margin: 0 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th style={{ textAlign: "right" }}>Per kg</th>
            <th style={{ textAlign: "right" }}>{`Total (${vol.toLocaleString("id-ID")} kg)`}</th>
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
            color="var(--up)"
          />
          <Row
            label="Keuntungan bersih"
            perUnit={result.netProfitPerUnit}
            total={result.totalProfit}
            bold
            color={result.isProfitable ? "var(--up)" : "var(--dn)"}
          />
        </tbody>
      </table>

      <div
        style={{
          padding: "10px 16px",
          background: "var(--paper2)",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          gap: 20,
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ color: "var(--ink-dim)" }}>
          Selisih harga:{" "}
          <b style={{ color: result.priceDiff > 0 ? "var(--up)" : "var(--dn)" }}>
            {formatRupiah(result.priceDiff)}/kg
          </b>
        </span>
        <span style={{ color: "var(--ink-dim)" }}>
          Break-even transport:{" "}
          <b style={{ color: "var(--ink)" }}>
            {formatRupiah(result.priceDiff > 0 ? result.priceDiff : 0)}/kg
          </b>
        </span>
      </div>
    </div>
  );
}

function Row({
  label, perUnit, total, bold, color,
}: {
  label: string;
  perUnit: number;
  total: number;
  bold?: boolean;
  color?: string;
}) {
  const style: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: bold ? 700 : 400,
    color: color ?? "var(--ink)",
    textAlign: "right",
  };
  return (
    <tr>
      <td style={{ fontWeight: bold ? 700 : 400, color: color ?? "var(--ink)" }}>{label}</td>
      <td style={style}>{formatRupiah(perUnit)}</td>
      <td style={style}>{formatRupiah(total)}</td>
    </tr>
  );
}
