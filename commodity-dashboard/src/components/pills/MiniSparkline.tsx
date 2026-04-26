export function MiniSparkline({
  values,
  trend = "flat",
  width = 32,
  height = 12,
}: {
  values: number[];
  trend?: "up" | "down" | "flat";
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height}>
        <line
          x1={2} y1={height / 2} x2={width - 2} y2={height / 2}
          stroke="var(--ink-dim)" strokeWidth={1.5} strokeLinecap="round"
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - 4) / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = 2 + i * stepX;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = trend === "up" ? "var(--up)" : trend === "down" ? "var(--dn)" : "var(--ink-dim)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
