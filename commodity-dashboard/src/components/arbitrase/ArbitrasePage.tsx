"use client";

import { useEffect, useMemo, useState } from "react";

type Sub = "ai" | "manual";

interface Vendor {
  id: string;
  name: string;
  moda: string;
  pricing_type: "per_km" | "flat_per_trip";
  price: number;
  capacity_kg: number | null;
  coverage: string | null;
  base_fare_rp: number | null;
  base_km: number | null;
}

interface Leg {
  id: string;
  commodity: string;
  kotaBeli: string;
  kotaJual: string;
  hargaBeli: string;
  hargaJual: string;
  volumeKg: string;
  vendorId: string;
  jarakKm: string;
}

interface LegResult {
  revenue: number;
  modalBeli: number;
  transportCost: number;
  netProfit: number;
  roi: number;
  trips: number;
  vendor: Vendor | null;
}

const COMMODITIES = [
  "Bawang Merah", "Bawang Putih Honan", "Beras Medium", "Beras Premium",
  "Cabai Merah Besar", "Cabai Merah Keriting", "Cabai Rawit Merah",
  "Daging Ayam Ras", "Daging Sapi Paha Belakang", "Garam Halus",
  "Gula Pasir Curah", "Ikan Kembung", "Minyak Goreng Sawit Curah",
  "Minyak Goreng Sawit Kemasan Premium", "Minyakita", "Telur Ayam Ras",
  "Tepung Terigu",
];

function fmtRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function calcTransportPerTrip(vendor: Vendor, jarakKm: number): number {
  if (vendor.pricing_type === "flat_per_trip") return vendor.price;
  if (jarakKm <= 0) return 0;
  if (vendor.base_fare_rp != null && vendor.base_km != null) {
    if (jarakKm <= vendor.base_km) return vendor.base_fare_rp;
    return vendor.base_fare_rp + (jarakKm - vendor.base_km) * vendor.price;
  }
  return jarakKm * vendor.price;
}

function newLeg(): Leg {
  return {
    id: Math.random().toString(36).slice(2),
    commodity: "Cabai Rawit Merah",
    kotaBeli: "",
    kotaJual: "",
    hargaBeli: "",
    hargaJual: "",
    volumeKg: "1000",
    vendorId: "",
    jarakKm: "",
  };
}

export function ArbitrasePage() {
  const [sub, setSub] = useState<Sub>("manual");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [legs, setLegs] = useState<Leg[]>([newLeg()]);

  useEffect(() => {
    fetch(`/api/transport-vendors?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setVendors((j.data ?? []) as Vendor[]))
      .catch(() => {});
  }, []);

  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLeg(id: string) {
    setLegs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.id !== id);
    });
  }

  const legResults = useMemo<(LegResult | null)[]>(() =>
    legs.map((leg) => {
      const hargaBeli = Number(leg.hargaBeli);
      const hargaJual = Number(leg.hargaJual);
      const volume = Number(leg.volumeKg);
      const km = Number(leg.jarakKm);

      if (!isFinite(hargaBeli) || hargaBeli <= 0) return null;
      if (!isFinite(hargaJual) || hargaJual <= 0) return null;
      if (!isFinite(volume) || volume <= 0) return null;

      const revenue = hargaJual * volume;
      const modalBeli = hargaBeli * volume;

      const vendor = vendors.find((v) => v.id === leg.vendorId) ?? null;
      let transportCost = 0;
      let trips = 1;

      if (vendor) {
        const tpt = calcTransportPerTrip(vendor, isFinite(km) && km > 0 ? km : 0);
        trips = vendor.capacity_kg && vendor.capacity_kg > 0
          ? Math.ceil(volume / vendor.capacity_kg)
          : 1;
        transportCost = tpt * trips;
      }

      const netProfit = revenue - modalBeli - transportCost;
      const roi = modalBeli > 0 ? (netProfit / modalBeli) * 100 : 0;

      return { revenue, modalBeli, transportCost, netProfit, roi, trips, vendor };
    }),
    [legs, vendors]
  );

  const chainSummary = useMemo(() => {
    const valid = legResults.filter(Boolean) as LegResult[];
    if (valid.length === 0) return null;
    const totalModal = valid.reduce((s, r) => s + r.modalBeli, 0);
    const totalTransport = valid.reduce((s, r) => s + r.transportCost, 0);
    const totalNet = valid.reduce((s, r) => s + r.netProfit, 0);
    const roi = totalModal > 0 ? (totalNet / totalModal) * 100 : 0;
    return { totalModal, totalTransport, totalNet, roi };
  }, [legResults]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab header */}
      <div style={{ padding: "12px 18px 0", background: "#f0ece4", borderBottom: "2px solid var(--rule)", flexShrink: 0 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
          <div style={{ width: 4, height: 22, borderRadius: 3, background: "var(--arb)", flexShrink: 0 }} />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>Arbitrase</div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Transport dari vendor DB · Manual kalkulator multi-leg · AI Suggestion → Phase 2
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <button
            type="button"
            className={`stab ${sub === "ai" ? "active" : ""}`}
            onClick={() => setSub("ai")}
          >
            🤖 AI Suggestion{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--arb)", background: "#ffedd5", padding: "1px 5px", borderRadius: 4, marginLeft: 3 }}>
              Phase 2
            </span>
          </button>
          <button
            type="button"
            className={`stab ${sub === "manual" ? "active" : ""}`}
            onClick={() => setSub("manual")}
          >
            ⚡ Manual Kalkulator
          </button>
        </div>
      </div>

      {sub === "ai" && <AISubtab />}

      {sub === "manual" && (
        <ManualSubtab
          legs={legs}
          vendors={vendors}
          legResults={legResults}
          chainSummary={chainSummary}
          onUpdateLeg={updateLeg}
          onRemoveLeg={removeLeg}
          onAddLeg={() => setLegs((prev) => [...prev, newLeg()])}
        />
      )}
    </div>
  );
}

/* ─── AI SUBTAB ──────────────────────────────────────── */

function AISubtab() {
  const [commFilter, setCommFilter] = useState("Semua");
  const [routeFilter, setRouteFilter] = useState<string | null>(null);

  const demoCards = [
    {
      rank: "⭐",
      commodity: "Cabai Rawit Merah",
      signal: "BELI" as const,
      roi: 54.6,
      from: "Yogyakarta", to: "Denpasar",
      routeDesc: "Jawa → Bali · darat + ferry · ~8.5 jam",
      jarak: "312 km + 60 km ferry",
      hargaBeli: 44500, hargaJual: 72000, volume: 1000,
      transport: [{ label: "Truk (312 km × Rp 1.200)", cost: 374400 }, { label: "Kapal Feri flat", cost: 2500000 }],
      netProfit: 24625600,
      pills: ["✓ Viable", "Risiko SEDANG", "HET+31%"],
      pillStyles: ["ok", "mid", "het"],
      reasoning: "Tren divergen 7 hari. Harga Yogyakarta stabil, Denpasar masih naik. Timing: 2–3 hari. Risk: volatilitas Denpasar 0.88.",
    },
    {
      rank: "02",
      commodity: "Bawang Merah",
      signal: "BELI" as const,
      roi: 18.4,
      from: "Yogyakarta", to: "Jakarta Sel.",
      routeDesc: "Jawa darat · ~7 jam · 560 km",
      jarak: "560 km",
      hargaBeli: 28000, hargaJual: 33500, volume: 500,
      transport: [{ label: "Truk (560 km × Rp 1.200)", cost: 672000 }],
      netProfit: 2078000,
      pills: ["✓ Viable", "Risiko RENDAH"],
      pillStyles: ["ok", "lo"],
      reasoning: "Spread konsisten 3 minggu. Rute darat stabil. Kapan saja.",
    },
  ];

  const aiSignalStyle: Record<string, React.CSSProperties> = {
    BELI: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    TUNGGU: { background: "#fef3c7", color: "#78350f", border: "1px solid #fde68a" },
    HINDARI: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  };

  const COMM_CHIPS = ["Semua", "Cabai Rawit", "Bawang Merah"];
  const ROUTE_CHIPS = ["Jawa only", "Lintas Pulau"];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Filter bar */}
      <div style={{ padding: "10px 18px", background: "var(--paper2)", borderBottom: "1px solid var(--rule)", display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-dim)" }}>KOMODITAS</span>
        {COMM_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCommFilter(c)}
            style={{
              padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              fontFamily: "var(--font-mono)", cursor: "pointer",
              border: `1px solid ${commFilter === c ? "var(--sp)" : "var(--rule)"}`,
              background: commFilter === c ? "var(--sp)" : "var(--paper)",
              color: commFilter === c ? "white" : "var(--ink-dim)",
              transition: "all .12s",
            }}
          >
            {c}
          </button>
        ))}
        <div style={{ width: 1, height: 14, background: "var(--rule)", margin: "0 4px" }} />
        {ROUTE_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setRouteFilter(routeFilter === c ? null : c)}
            style={{
              padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              fontFamily: "var(--font-mono)", cursor: "pointer",
              border: `1px solid ${routeFilter === c ? "var(--arb)" : "var(--rule)"}`,
              background: routeFilter === c ? "var(--arb)" : "var(--paper)",
              color: routeFilter === c ? "white" : "var(--ink-dim)",
              transition: "all .12s",
            }}
          >
            {c}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>Sort:</span>
          <button
            type="button"
            style={{
              padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              fontFamily: "var(--font-mono)", cursor: "pointer",
              border: "1px solid var(--arb)", background: "var(--arb)", color: "white",
            }}
          >
            ROI Tertinggi ▾
          </button>
        </div>
      </div>

      {/* Phase 2 notice */}
      <div style={{ margin: "10px 18px 0", padding: "9px 13px", background: "#ffedd5", border: "1px solid #fed7aa", borderRadius: 8, display: "flex", alignItems: "center", gap: 9, fontSize: 11, color: "var(--arb)", flexShrink: 0 }}>
        <span>🤖</span>
        <div>
          <b>Data demo</b> — Di Phase 2, peluang ini akan ter-generate otomatis dari{" "}
          <span className="font-mono" style={{ fontSize: 10 }}>komparasi_harga VIEW</span>{" "}
          (SP2KP × Pedagang) dan vendor transport DB. Gunakan{" "}
          <button type="button" style={{ fontWeight: 700, textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "inherit" }}>
            Manual Kalkulator
          </button>{" "}
          untuk kalkulasi nyata sekarang.
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
        {demoCards.map((card, idx) => (
          <div
            key={idx}
            style={{
              background: "white",
              border: `1px solid ${idx === 0 ? "var(--sp)" : "var(--rule)"}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Card head */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "var(--paper2)", borderBottom: "1px solid var(--rule)" }}>
              <span className="font-mono" style={{ fontSize: 10, color: idx === 0 ? "#78350f" : "var(--ink-mid)" }}>{card.rank}</span>
              <div className="font-serif" style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{card.commodity}</div>
              <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", ...aiSignalStyle[card.signal] }}>
                🤖 {card.signal}
              </span>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: card.roi > 30 ? "var(--sp)" : "var(--ped)" }}>
                  ROI {fmtPct(card.roi)}
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: "var(--ink-dim)" }}>net setelah logistik</div>
              </div>
            </div>

            {/* Card body 3-col */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--rule)" }}>
              {/* Rute */}
              <div style={{ padding: "9px 13px", borderRight: "1px solid var(--rule)" }}>
                <div style={arbSecT}>Rute</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  <span className="font-serif" style={{ fontWeight: 600 }}>{card.from}</span>
                  <span style={{ color: "var(--ink-dim)", fontSize: 10 }}>──→</span>
                  <span className="font-serif" style={{ fontWeight: 600 }}>{card.to}</span>
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: "var(--ink-dim)", marginBottom: 5 }}>{card.routeDesc}</div>
                <ArbPriceRow label="Jarak" value={card.jarak} />
              </div>

              {/* Kalkulasi */}
              <div style={{ padding: "9px 13px", borderRight: "1px solid var(--rule)" }}>
                <div style={arbSecT}>Kalkulasi ({card.volume.toLocaleString("id-ID")} kg)</div>
                <ArbPriceRow label="Harga beli" value={<span style={{ color: "var(--up)" }}>{fmtRp(card.hargaBeli)}/kg</span>} />
                <ArbPriceRow label="Harga jual" value={<span style={{ color: "var(--dn)" }}>{fmtRp(card.hargaJual)}/kg</span>} />
                <ArbPriceRow label="Modal beli" value={fmtRp(card.hargaBeli * card.volume)} />
                {card.transport.map((t, i) => (
                  <ArbPriceRow key={i} label={t.label} value={fmtRp(t.cost)} />
                ))}
              </div>

              {/* Hasil */}
              <div style={{ padding: "9px 13px" }}>
                <div style={arbSecT}>Hasil Bersih</div>
                <div style={{ marginBottom: 7 }}>
                  <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginBottom: 2 }}>Net Profit</div>
                  <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--up)" }}>{fmtRp(card.netProfit)}</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {card.pills.map((p, i) => (
                    <span key={i} className={`pill pill-${card.pillStyles[i]}`} style={{ fontSize: 9 }}>{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "8px 13px", background: "#fafaf8", fontSize: 11, color: "var(--ink-mid)", lineHeight: 1.5, display: "flex", gap: 7 }}>
              <span>🤖</span>
              <span><b>{card.signal}</b> — {card.reasoning}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const arbSecT: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: ".9px", color: "var(--ink-dim)",
  fontFamily: "var(--font-mono)", marginBottom: 6,
};

function ArbPriceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--font-mono)", padding: "2px 0", color: "var(--ink-mid)" }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

/* ─── MANUAL SUBTAB ──────────────────────────────────── */

interface ManualSubtabProps {
  legs: Leg[];
  vendors: Vendor[];
  legResults: (LegResult | null)[];
  chainSummary: { totalModal: number; totalTransport: number; totalNet: number; roi: number } | null;
  onUpdateLeg: (id: string, patch: Partial<Leg>) => void;
  onRemoveLeg: (id: string) => void;
  onAddLeg: () => void;
}

function ManualSubtab({ legs, vendors, legResults, chainSummary, onUpdateLeg, onRemoveLeg, onAddLeg }: ManualSubtabProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div className="font-serif" style={{ fontSize: 14, fontWeight: 700 }}>Manual Arbitrase Calculator</div>
          <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
            Multi-leg bebas · Vendor dari DB · Harga manual atau ambil dari SP2KP (Phase 2)
          </div>
        </div>
      </div>

      {/* Leg cards */}
      {legs.map((leg, idx) => (
        <LegCard
          key={leg.id}
          leg={leg}
          index={idx}
          vendors={vendors}
          result={legResults[idx]}
          canRemove={legs.length > 1}
          onUpdate={(patch) => onUpdateLeg(leg.id, patch)}
          onRemove={() => onRemoveLeg(leg.id)}
        />
      ))}

      {/* Add leg */}
      <button
        type="button"
        onClick={onAddLeg}
        style={{
          width: "100%", padding: 10,
          border: "2px dashed var(--rule-mid)", borderRadius: 8,
          background: "transparent", fontFamily: "var(--font-sans)",
          fontSize: 12, fontWeight: 500, color: "var(--ink-dim)",
          cursor: "pointer", marginBottom: 14,
          transition: "all .14s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--arb)"; e.currentTarget.style.color = "var(--arb)"; e.currentTarget.style.background = "#ffedd5"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rule-mid)"; e.currentTarget.style.color = "var(--ink-dim)"; e.currentTarget.style.background = "transparent"; }}
      >
        + Tambah Leg Baru
      </button>

      {/* Chain summary */}
      {chainSummary && (
        <div style={{ background: "var(--ink)", borderRadius: 8, padding: "14px 16px", color: "var(--paper)" }}>
          <div className="font-serif" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            📊 Chain Summary — {legs.length} Leg
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
            <SummaryCell label="Total Modal" value={fmtRp(chainSummary.totalModal)} color="#fcd34d" />
            <SummaryCell label="Total Transport" value={fmtRp(chainSummary.totalTransport)} color="rgba(245,241,234,.55)" />
            <SummaryCell label="Net Profit" value={fmtRp(chainSummary.totalNet)} color={chainSummary.totalNet >= 0 ? "#6ee7a0" : "#fca5a5"} />
            <SummaryCell label="ROI Chain" value={fmtPct(chainSummary.roi)} color={chainSummary.roi >= 0 ? "#6ee7a0" : "#fca5a5"} />
          </div>
          <div style={{ borderTop: "1px solid rgba(245,241,234,.1)", paddingTop: 9, display: "flex", gap: 7, alignItems: "center" }}>
            {chainSummary.totalNet >= 0 ? (
              <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, background: "rgba(110,231,160,.12)", color: "#6ee7a0", border: "1px solid rgba(110,231,160,.25)" }}>
                ✓ Viable
              </span>
            ) : (
              <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, background: "rgba(252,100,100,.12)", color: "#fca5a5", border: "1px solid rgba(252,100,100,.25)" }}>
                ✗ Rugi
              </span>
            )}
            <span className="font-mono" style={{ fontSize: 10, color: "rgba(245,241,234,.35)", marginLeft: "auto" }}>
              Harga manual · Vendor transport DB ✓
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".9px", color: "rgba(245,241,234,.4)", marginBottom: 3 }}>
        {label}
      </div>
      <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

/* ─── LEG CARD ───────────────────────────────────────── */

interface LegCardProps {
  leg: Leg;
  index: number;
  vendors: Vendor[];
  result: LegResult | null;
  canRemove: boolean;
  onUpdate: (patch: Partial<Leg>) => void;
  onRemove: () => void;
}

function LegCard({ leg, index, vendors, result, canRemove, onUpdate, onRemove }: LegCardProps) {
  const selectedVendor = vendors.find((v) => v.id === leg.vendorId) ?? null;
  const km = Number(leg.jarakKm);
  const validKm = isFinite(km) && km > 0;

  const transportPerTrip = selectedVendor
    ? calcTransportPerTrip(selectedVendor, validKm ? km : 0)
    : null;

  const routeLabel = leg.kotaBeli && leg.kotaJual
    ? `${leg.kotaBeli} → ${leg.kotaJual}`
    : `Leg ${index + 1}`;

  return (
    <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
      {/* Leg header */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", background: "var(--paper2)", borderBottom: "1px solid var(--rule)" }}>
        <div style={{ width: 21, height: 21, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {index + 1}
        </div>
        <div className="font-serif" style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
          Leg {index + 1} — {routeLabel}
        </div>
        {result && (
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: result.roi >= 0 ? "var(--up)" : "var(--dn)" }}>
            ROI {fmtPct(result.roi)}
          </span>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{ padding: "3px 8px", background: "var(--dn-bg)", color: "var(--dn)", border: "1px solid #fecaca", borderRadius: 5, fontSize: 10, cursor: "pointer" }}
          >
            Hapus
          </button>
        )}
      </div>

      {/* Inputs grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, padding: "11px 13px", borderBottom: "1px solid var(--rule)" }}>
        <LgField label="Komoditas">
          <select value={leg.commodity} onChange={(e) => onUpdate({ commodity: e.target.value })} style={lgSelectStyle}>
            {COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </LgField>
        <LgField label="Kota Beli">
          <input
            type="text"
            value={leg.kotaBeli}
            onChange={(e) => onUpdate({ kotaBeli: e.target.value })}
            placeholder="Yogyakarta"
            style={lgInputStyle}
          />
        </LgField>
        <LgField label="Kota Jual">
          <input
            type="text"
            value={leg.kotaJual}
            onChange={(e) => onUpdate({ kotaJual: e.target.value })}
            placeholder="Denpasar"
            style={lgInputStyle}
          />
        </LgField>

        <LgField label="Harga Beli (Rp/kg)">
          <div style={{ position: "relative" }}>
            <input
              type="number"
              min={0}
              value={leg.hargaBeli}
              onChange={(e) => onUpdate({ hargaBeli: e.target.value })}
              placeholder="44500"
              style={{ ...lgInputStyle, paddingRight: 36, fontFamily: "var(--font-mono)" }}
            />
            <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--sp)", fontWeight: 700, pointerEvents: "none" }}>
              /kg
            </span>
          </div>
        </LgField>
        <LgField label="Harga Jual (Rp/kg)">
          <div style={{ position: "relative" }}>
            <input
              type="number"
              min={0}
              value={leg.hargaJual}
              onChange={(e) => onUpdate({ hargaJual: e.target.value })}
              placeholder="72000"
              style={{ ...lgInputStyle, paddingRight: 36, fontFamily: "var(--font-mono)" }}
            />
            <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--dn)", fontWeight: 700, pointerEvents: "none" }}>
              /kg
            </span>
          </div>
        </LgField>
        <LgField label="Volume (kg)">
          <input
            type="number"
            min={1}
            value={leg.volumeKg}
            onChange={(e) => onUpdate({ volumeKg: e.target.value })}
            placeholder="1000"
            style={{ ...lgInputStyle, fontFamily: "var(--font-mono)" }}
          />
        </LgField>

        <div style={{ gridColumn: "1 / 3" }}>
          <LgField label="Vendor Transport">
            <select
              value={leg.vendorId}
              onChange={(e) => onUpdate({ vendorId: e.target.value })}
              style={lgSelectStyle}
            >
              <option value="">— Pilih vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.pricing_type === "per_km" ? `Rp ${v.price.toLocaleString("id-ID")}/km` : `Flat Rp ${v.price.toLocaleString("id-ID")}`}
                  {v.capacity_kg ? ` · ${v.capacity_kg.toLocaleString("id-ID")} kg` : ""}
                </option>
              ))}
            </select>
          </LgField>
        </div>
        <LgField label={selectedVendor?.pricing_type === "per_km" ? "Jarak (km)" : "Trips"}>
          {selectedVendor?.pricing_type === "per_km" ? (
            <input
              type="number"
              min={0}
              value={leg.jarakKm}
              onChange={(e) => onUpdate({ jarakKm: e.target.value })}
              placeholder="312"
              style={{ ...lgInputStyle, fontFamily: "var(--font-mono)" }}
            />
          ) : (
            <input
              value={result ? `${result.trips} trip` : "1 trip"}
              readOnly
              style={{ ...lgInputStyle, background: "var(--paper3)", color: "var(--ink-dim)" }}
            />
          )}
        </LgField>
      </div>

      {/* Distance / cost info row */}
      {(selectedVendor || validKm) && (
        <div style={{ padding: "7px 13px", background: "#f7f5f0", borderBottom: "1px solid var(--rule)", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-mid)" }}>
          {selectedVendor?.pricing_type === "per_km" && validKm && (
            <span>🗺 Jarak: <span style={{ color: "var(--ink)", fontWeight: 500 }}>{km.toLocaleString("id-ID")} km</span></span>
          )}
          {selectedVendor && transportPerTrip != null && (
            <span>💰 Transport/trip: <span style={{ color: "var(--ink)", fontWeight: 500 }}>{fmtRp(transportPerTrip)}</span></span>
          )}
          {result && result.trips > 1 && (
            <span>🚛 Trips: <span style={{ color: "var(--ink)", fontWeight: 500 }}>{result.trips}×</span></span>
          )}
          {result && result.transportCost > 0 && (
            <span>💸 Total transport: <span style={{ color: "var(--arb)", fontWeight: 500 }}>{fmtRp(result.transportCost)}</span></span>
          )}
          {selectedVendor?.base_fare_rp != null && selectedVendor.pricing_type === "per_km" && (
            <span>⚡ Dasar: <span style={{ color: "var(--ink)", fontWeight: 500 }}>Rp {selectedVendor.base_fare_rp.toLocaleString("id-ID")} / {selectedVendor.base_km} km</span></span>
          )}
        </div>
      )}

      {/* Result row */}
      {result ? (
        <div style={{ padding: "10px 13px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
          <LrCell label="Pendapatan" value={fmtRp(result.revenue)} />
          <LrCell label="Modal Beli" value={fmtRp(result.modalBeli)} />
          <LrCell label="Biaya Transport" value={fmtRp(result.transportCost)} color="var(--arb)" />
          <LrCell
            label="Net Profit"
            value={fmtRp(result.netProfit)}
            color={result.netProfit >= 0 ? "var(--up)" : "var(--dn)"}
          />
        </div>
      ) : (
        <div style={{ padding: "10px 13px" }}>
          <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
            Isi harga beli, harga jual, dan volume untuk melihat hasil kalkulasi.
          </div>
        </div>
      )}
    </div>
  );
}

function LgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".9px", color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function LrCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
        {label}
      </div>
      <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

const lgSelectStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  background: "var(--paper2)",
  color: "var(--ink)",
  width: "100%",
  outline: "none",
};

const lgInputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  background: "var(--paper2)",
  color: "var(--ink)",
  width: "100%",
  outline: "none",
};
