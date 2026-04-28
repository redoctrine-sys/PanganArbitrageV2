"use client";

import { useMemo } from "react";
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

type RcPayload = any;

/* ── Colors ─────────────────────────────────────────── */

const BULL = "#166534";
const BEAR = "#991b1b";
const BULL_FILL = "#22c55e";
const BEAR_FILL = "#ef4444";

/* ── Transform data for Recharts ─────────────────── */
// Recharts doesn't natively support candlestick. We use a stacked bar chart trick:
// - "base" bar: invisible, from yMin to min(open, close)
// - "body" bar: colored, from min(open, close) to max(open, close)
// Plus an ErrorBar-like approach for wicks won't work, so we render wicks via a custom shape.

interface CandleRow {
  label: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  base: number;      // invisible spacer height
  body: number;       // visible candle body height
  isBull: boolean;
}

function transformCandles(candles: CandleData[]): { rows: CandleRow[]; yMin: number; yMax: number } {
  let globalMin = Infinity, globalMax = -Infinity;
  for (const c of candles) {
    if (c.low < globalMin) globalMin = c.low;
    if (c.high > globalMax) globalMax = c.high;
  }
  const pad = (globalMax - globalMin) * 0.12 || 1;
  const yMin = globalMin - pad;
  const yMax = globalMax + pad;

  const rows: CandleRow[] = candles.map((c) => {
    const isBull = c.close >= c.open;
    const bodyBottom = Math.min(c.open, c.close);
    const bodyTop = Math.max(c.open, c.close);
    return {
      ...c,
      base: bodyBottom - yMin,
      body: Math.max(bodyTop - bodyBottom, (yMax - yMin) * 0.003), // min visible size
      isBull,
    };
  });

  return { rows, yMin, yMax };
}

/* ── Custom Bar shape with wick ────────────────────── */

function CandleBodyShape(props: RcPayload) {
  const { x, y, width, height: h, payload } = props;
  if (!payload) return null;

  const isBull = payload.isBull;
  const color = isBull ? BULL : BEAR;
  const fill = isBull ? BULL_FILL : BEAR_FILL;

  const centerX = x + width / 2;
  const bodyWidth = Math.max(width * 0.65, 5);
  const bodyX = centerX - bodyWidth / 2;

  // Compute wick positions relative to the bar
  // The bar represents the "body" portion. We need to find where high and low are
  // relative to the body.
  const bodyBottom = Math.min(payload.open, payload.close);
  const bodyTop = Math.max(payload.open, payload.close);
  const bodyRange = bodyTop - bodyBottom || 1;

  // The bar's y is the TOP of the body, y+h is the BOTTOM
  // Since Recharts stacks base+body, the body bar top = y, bottom = y+h
  const pxPerUnit = h / bodyRange;

  const wickTopY = y - (payload.high - bodyTop) * pxPerUnit;
  const wickBottomY = y + h + (bodyBottom - payload.low) * pxPerUnit;

  return (
    <g>
      {/* Upper wick: high to bodyTop */}
      <line
        x1={centerX}
        y1={wickTopY}
        x2={centerX}
        y2={y}
        stroke={color}
        strokeWidth={1.2}
      />
      {/* Lower wick: bodyBottom to low */}
      <line
        x1={centerX}
        y1={y + h}
        x2={centerX}
        y2={wickBottomY}
        stroke={color}
        strokeWidth={1.2}
      />
      {/* Body */}
      <rect
        x={bodyX}
        y={y}
        width={bodyWidth}
        height={Math.max(h, 1.5)}
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
  payload?: { payload: CandleRow }[];
}) {
  if (!active || !payload?.[0]) return null;
  const c = payload[0].payload;
  const color = c.isBull ? BULL : BEAR;

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
      <div style={{ color: BULL }}>H: {formatRupiah(c.high)}</div>
      <div style={{ color: BEAR }}>L: {formatRupiah(c.low)}</div>
      <div style={{ fontWeight: 600, color }}>C: {formatRupiah(c.close)}</div>
      <div style={{ color: "#8a8580", fontSize: 9, marginTop: 2 }}>
        {c.volume} hari data
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */

export function CandlestickChart({ candles, het, height = 200 }: Props) {
  const { rows, yMin, yMax } = useMemo(() => transformCandles(candles), [candles]);

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

  // Adjust Y domain for HET
  let adjYMin = yMin, adjYMax = yMax;
  if (het != null) {
    if (het < adjYMin) adjYMin = het - (yMax - yMin) * 0.05;
    if (het > adjYMax) adjYMax = het + (yMax - yMin) * 0.05;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={rows}
        margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
        barCategoryGap="15%"
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
          domain={[adjYMin, adjYMax]}
          tick={{ fontSize: 9, fill: "#8a8580", fontFamily: "var(--font-mono)" }}
          stroke="#c4bfb5"
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          width={42}
        />
        <Tooltip content={<CandleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />

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

        {/* Invisible base bar — spacer from yMin to body bottom */}
        <Bar
          dataKey="base"
          stackId="candle"
          fill="transparent"
          isAnimationActive={false}
        />

        {/* Visible body bar with custom shape including wicks */}
        <Bar
          dataKey="body"
          stackId="candle"
          shape={<CandleBodyShape />}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
