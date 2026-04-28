"use client";

import { useEffect, useMemo, useState } from "react";
import { CityColHeader, CityRow, type CityGroup } from "@/components/sp2kp/CityRow";
import {
  CommodityGroupColHeader,
  CommodityGroupRow,
  type CommodityGroup,
} from "@/components/sp2kp/CommodityGroupRow";
import type { Island, SP2KPLatestRow } from "@/types/sp2kp";
import { formatDateLong } from "@/lib/utils/date";

const ISLANDS: (Island | "Semua")[] = ["Semua", "Jawa", "Madura", "Bali", "Lombok"];

type View = "city" | "commodity";

export function SP2KPPage() {
  const [data, setData] = useState<SP2KPLatestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("city");
  const [island, setIsland] = useState<Island | "Semua">("Semua");
  const [province, setProvince] = useState<string | "Semua">("Semua");
  const [search, setSearch] = useState("");
  const [openCity, setOpenCity] = useState<string | null>(null);
  const [openCommodity, setOpenCommodity] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (island !== "Semua") params.set("island", island);
        const res = await fetch(`/api/sp2kp/latest?${params.toString()}`);
        const json = await res.json();
        if (!cancel) {
          if (json.error) setError(json.error);
          setData((json.data ?? []) as SP2KPLatestRow[]);
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Gagal memuat data");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [island]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) if (r.province) set.add(r.province);
    return ["Semua", ...[...set].sort()];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (province !== "Semua" && r.province !== province) return false;
      if (!q) return true;
      return (
        r.city_raw.toLowerCase().includes(q) ||
        r.commodity_name.toLowerCase().includes(q) ||
        r.province.toLowerCase().includes(q)
      );
    });
  }, [data, province, search]);

  const cityGroups = useMemo<CityGroup[]>(() => {
    const map = new Map<string, CityGroup>();
    for (const r of filtered) {
      let g = map.get(r.kode_wilayah);
      if (!g) {
        g = {
          kode_wilayah: r.kode_wilayah,
          city_raw: r.city_raw,
          province: r.province,
          island: r.island,
          entity_type: r.entity_type,
          rows: [],
        };
        map.set(r.kode_wilayah, g);
      }
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => {
      const aAnom = a.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      const bAnom = b.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      if (aAnom !== bAnom) return aAnom - bAnom;
      return a.city_raw.localeCompare(b.city_raw);
    });
  }, [filtered]);

  const commodityGroups = useMemo<CommodityGroup[]>(() => {
    const map = new Map<string, CommodityGroup>();
    for (const r of filtered) {
      let g = map.get(r.commodity_id);
      if (!g) {
        g = {
          commodity_id: r.commodity_id,
          commodity_name: r.commodity_name,
          category: r.category,
          unit: r.unit,
          rows: [],
        };
        map.set(r.commodity_id, g);
      }
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => {
      const aAnom = a.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      const bAnom = b.rows.some((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02) ? 0 : 1;
      if (aAnom !== bAnom) return aAnom - bAnom;
      return a.commodity_name.localeCompare(b.commodity_name);
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const cities = new Set(data.map((r) => r.kode_wilayah));
    const commodities = new Set(data.map((r) => r.commodity_id));
    const latestDate = data.reduce<string | null>((m, r) => (m == null || r.date_latest > m ? r.date_latest : m), null);
    const aboveHet = data.filter((r) => r.het_ha != null && r.price_latest > r.het_ha * 1.02).length;
    return { cities: cities.size, commodities: commodities.size, latestDate, aboveHet };
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header stats={stats} view={view} onViewChange={setView} />

      <div className="fbar">
        <div className="fsearch">
          <span style={{ color: "var(--ink-dim)" }}>⌕</span>
          <input
            placeholder={
              view === "city"
                ? "Cari kota / komoditas / provinsi..."
                : "Cari komoditas / kota..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {ISLANDS.map((i) => (
          <button
            key={i}
            type="button"
            className={`fbtn ${island === i ? "on" : ""}`}
            onClick={() => { setIsland(i); setProvince("Semua"); }}
          >
            {i}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
            Provinsi:
          </span>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={{
              padding: "4px 8px", borderRadius: 6,
              border: "1px solid var(--rule)", background: "var(--paper)",
              fontSize: 11, color: "var(--ink-mid)", outline: "none",
            }}
          >
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="fhint">
          {view === "city"
            ? "Klik kota → komoditas · Klik komoditas → chart · HET di detail"
            : "Klik komoditas → kota · Klik kota → chart · HET di detail"}
        </div>
      </div>

      {view === "city" ? <CityColHeader /> : <CommodityGroupColHeader />}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div className="empty">
            <div className="empty-title">Memuat data SP2KP...</div>
          </div>
        )}
        {!loading && error && (
          <div className="empty">
            <div className="empty-title" style={{ color: "var(--dn)" }}>Gagal memuat</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}
        {!loading && !error && view === "city" && cityGroups.length === 0 && (
          <div className="empty">
            <div className="empty-title">Belum ada data SP2KP.</div>
            <div className="empty-sub">
              Klik <b>Upload SP2KP</b> di topbar untuk ingest file Tabulasi_SP2KP (CSV/XLSX).
              Data akan langsung tampil setelah upload — tanpa approval.
            </div>
          </div>
        )}
        {!loading && !error && view === "commodity" && commodityGroups.length === 0 && (
          <div className="empty">
            <div className="empty-title">Belum ada data SP2KP.</div>
            <div className="empty-sub">
              Klik <b>Upload SP2KP</b> di topbar untuk ingest file Tabulasi_SP2KP (CSV/XLSX).
            </div>
          </div>
        )}
        {!loading && !error && view === "city" && cityGroups.map((g, i) => (
          <CityRow
            key={g.kode_wilayah}
            group={g}
            index={i}
            isOpen={openCity === g.kode_wilayah}
            onToggle={() => setOpenCity((cur) => (cur === g.kode_wilayah ? null : g.kode_wilayah))}
          />
        ))}
        {!loading && !error && view === "commodity" && commodityGroups.map((g, i) => (
          <CommodityGroupRow
            key={g.commodity_id}
            group={g}
            index={i}
            isOpen={openCommodity === g.commodity_id}
            onToggle={() => setOpenCommodity((cur) => (cur === g.commodity_id ? null : g.commodity_id))}
          />
        ))}
      </div>
    </div>
  );
}

function Header({
  stats,
  view,
  onViewChange,
}: {
  stats: { cities: number; commodities: number; latestDate: string | null; aboveHet: number };
  view: View;
  onViewChange: (v: View) => void;
}) {
  return (
    <div
      style={{
        padding: "12px 18px 0",
        background: "#f0ece4",
        borderBottom: "2px solid var(--rule)",
        flexShrink: 0,
      }}
    >
      <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
        <div
          style={{ width: 4, height: 22, borderRadius: 3, background: "var(--sp)", flexShrink: 0 }}
        />
        <div>
          <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>
            SP2KP — Sistem Pemantauan Pasar &amp; Kebutuhan Pokok
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 10, color: "var(--ink-dim)" }}
          >
            Kemendag · Upload CSV/XLSX ad hoc · Sumber data primer · HET/HA tersedia sebagai detail
          </div>
        </div>
      </div>
      <div className="flex" style={{ gap: 7, marginBottom: 9 }}>
        <Stat label="Kab/Kota" value={stats.cities ? String(stats.cities) : "—"} />
        <Stat label="Komoditas" value={stats.commodities ? String(stats.commodities) : "—"} />
        <Stat label="Anomali HET" value={stats.aboveHet > 0 ? String(stats.aboveHet) : "0"} accent={stats.aboveHet > 0 ? "var(--dn)" : undefined} />
        <Stat label="Data terbaru" value={stats.latestDate ? formatDateLong(stats.latestDate) : "—"} />
      </div>
      <div style={{ display: "flex", gap: 3, paddingBottom: 9 }}>
        <div
          role="button"
          tabIndex={0}
          className={`stab ${view === "city" ? "active" : ""}`}
          onClick={() => onViewChange("city")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewChange("city"); }}
        >
          📍 By City
        </div>
        <div
          role="button"
          tabIndex={0}
          className={`stab ${view === "commodity" ? "active" : ""}`}
          onClick={() => onViewChange("commodity")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onViewChange("commodity"); }}
        >
          🌾 By Commodity
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="sc">
      <div className="sc-l">{label}</div>
      <div className="sc-v" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}
