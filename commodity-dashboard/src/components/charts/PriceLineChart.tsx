"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/analytics/metrics";
import { formatDateShort } from "@/lib/utils/date";
import type { PricePoint } from "@/types/sp2kp";

interface Props {
  points: PricePoint[];
  het: number | null;
  avg30: number | null;
  height?: number;
}

export function PriceLineChart({ points, het, avg30, height = 200 }: Props) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-ink-dim text-[12px] font-mono"
        style={{ height }}
      >
        Belum ada data harga harian.
      </div>
    );
  }

  const data = points.map((p) => ({
    date: p.date,
    price: p.price,
    label: formatDateShort(p.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e1d8" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: "#8a8580", fontFamily: "var(--font-mono)" }}
          stroke="#c4bfb5"
          axisLine={false}
          tickLine={false}
          minTickGap={20}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "#8a8580", fontFamily: "var(--font-mono)" }}
          stroke="#c4bfb5"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          width={42}
        />
        <Tooltip
          formatter={(val: number) => [formatRupiah(val), "Harga"]}
          labelFormatter={(label) => label}
          contentStyle={{
            background: "white", border: "1px solid var(--rule)",
            borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)",
          }}
        />
        {het != null && (
          <ReferenceLine
            y={het}
            stroke="#991b1b"
            strokeDasharray="4 3"
            label={{
              value: `HET ${formatRupiah(het)}`,
              position: "right",
              fill: "#991b1b",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
          />
        )}
        {avg30 != null && (
          <ReferenceLine
            y={avg30}
            stroke="#c4bfb5"
            strokeDasharray="4 3"
            label={{
              value: `Avg ${formatRupiah(avg30)}`,
              position: "left",
              fill: "#8a8580",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="price"
          stroke="var(--sp)"
          strokeWidth={2}
          connectNulls={true}
          dot={{ r: 2.5, fill: "white", stroke: "var(--sp)", strokeWidth: 2 }}
          activeDot={{ r: 4, fill: "var(--sp)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
