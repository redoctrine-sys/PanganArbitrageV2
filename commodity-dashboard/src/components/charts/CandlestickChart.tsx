"use client";

import {
  CartesianGrid, ComposedChart, Bar, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/analytics/metrics";
import type { CandleData } from "@/types/sp2kp";

/* ── Types ──────────────────────────────────────────── */

interface Props {
  candles: CandleData[];
  het: number | null;
  height?: number;
}

// Recharts Bar shape receives these props
interface CandleShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: CandleData;
  yAxis: { scale: (v: number) => number };
}

// Tooltip payload from Recharts
interface TooltipEntry {
  payload: CandleData;
}

/* ── Colors ─────────────────────────────────────────── */

const BULL = "#166534"; // green — close ≥ open
const BEAR = "#991b1b"; // red   — close < open
const BULL_FILL = "#16a34a";
const BEAR_FILL = "#ef4444";

/* ── Custom Candle Shape ────────────────────────────── */

function CandleShape(props: unknown) {
  const { x, width, payload, yAxis } = props as CandleShapeProps;
  if (!payload || !yAxis?.scale) return null;

  const { open, high, low, close } = payload;
  const isBull = close >= open;

  const yHigh  = yAxis.scale(high);
  const yLow   = yAxis.scale(low);
  const yOpen  = yAxis.scale(open);
  const yClose = yAxis.scale(close);

  const bodyTop    = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1);

  const centerX = x + width / 2;
  const bodyWidth = Math.max(width * 0.7, 6);
  const bodyX = centerX - bodyWidth / 2;

  const color = isBull ? BULL : BEAR;
  const fill  = isBull ? BULL_FILL : BEAR_FILL;

  return (
    <g>
      {/* Wick — high to low */}
      <line
        x1={centerX}
        y1={yHigh}
        x2={centerX}
        y2={yLow}
        stroke={color}
        strokeWidth={1.2}
      />
      {/* Body — open to close */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={fill}
        stroke={color}
        strokeWidth={0.8}
        rx={1}
      />
    </g>
  );
}

/* ── Custom Tooltip ─────────────────────────────────── */

function CandleTooltip({ active, payload }: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.[0]) return null;
  const c = payload[0].payload;
  const isBull = c.close >= c.open;
  const color = isBull ? BULL : BEAR;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--rule)",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        lineHeight: 1.6,
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 3, color }}>
        {c.label}
      </div>
      <div>O: {formatRupiah(c.open)}</div>
      <div>H: {formatRupiah(c.high)}</div>
      <div>L: {formatRupiah(c.low)}</div>
      <div style={{ fontWeight: 600, color }}>C: {formatRupiah(c.close)}</div>
      <div style={{ color: "#8a8580", fontSize: 9, marginTop: 2 }}>
        {c.volume} observasi
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */

export function CandlestickChart({ candles, het, height = 200 }: Props) {
  if (candles.length === 0) {
    return (
      <div
        style={{
          height, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-dim)", fontSize: 12, fontFamily: "var(--font-mono)",
        }}
      >
        Belum cukup data untuk candlestick.
      </div>
    );
  }

  // Compute Y domain with padding
  let yMin = Infinity, yMax = -Infinity;
  for (const c of candles) {
    if (c.low < yMin) yMin = c.low;
    if (c.high > yMax) yMax = c.high;
  }
  if (het != null) {
    if (het < yMin) yMin = het;
    if (het > yMax) yMax = het;
  }
  const pad = (yMax - yMin) * 0.12;
  yMin = yMin - pad;
  yMax = yMax + pad;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={candles}
        margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke="#e5e1d8" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 8, fill: "#8a8580", fontFamily: "var(--font-mono)" }}
          stroke="#c4bfb5"
          axisLine={false}
          tickLine={false}
          minTickGap={8}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 9, fill: "#8a8580", fontFamily: "var(--font-mono)" }}
          stroke="#c4bfb5"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          width={42}
        />
        <Tooltip content={<CandleTooltip />} cursor={false} />

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

        {/* Invisible bar that drives the x-axis layout + provides yAxis scale to shape */}
        <Bar
          dataKey="high"
          shape={<CandleShape />}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
