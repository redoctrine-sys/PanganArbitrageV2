import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: { DEFAULT: "#1a1612", mid: "#4a4540", dim: "#8a8580" },
        paper: { DEFAULT: "#f5f1ea", "2": "#edeae2", "3": "#e5e1d8" },
        rule: { DEFAULT: "#d8d4cb", mid: "#c4bfb5" },
        sp: { DEFAULT: "#1b5e3b", light: "#e8f3ec", mid: "#2d7a52" },
        ped: { DEFAULT: "#1e3a5f", light: "#dbeafe" },
        comp: { DEFAULT: "#4c1d95", light: "#ede9fe" },
        arb: { DEFAULT: "#7c2d12", light: "#ffedd5" },
        up: { DEFAULT: "#166534", bg: "#dcfce7" },
        dn: { DEFAULT: "#991b1b", bg: "#fee2e2" },
        warn: { DEFAULT: "#78350f", bg: "#fef3c7" },
        hi: { DEFAULT: "#9a3412", bg: "#ffedd5" },
        lo: { DEFAULT: "#14532d", bg: "#dcfce7" },
        midc: { DEFAULT: "#713f12", bg: "#fef9c3" },
      },
      borderRadius: { DEFAULT: "8px" },
    },
  },
  plugins: [],
};

export default config;
