"use client";

import { useEffect, useMemo, useState } from "react";
import { CityColHeader, CityRow, type CityGroup } from "@/components/sp2kp/CityRow";
import {
  CommodityGroupColHeader,
  CommodityGroupRow,
  sortCommodityGroups,
  type CommodityGroup,
  type CommodityGroupSort,
  type CommodityGroupSortKey,
} from "@/components/sp2kp/CommodityGroupRow";
import type { Island, SP2KPLatestRow } from "@/types/sp2kp";
import { HET_ANOMALY_THRESHOLD } from "@/lib/constants";
import { SP2KPHeader, type View } from "@/components/sp2kp/SP2KPHeader";


const ISLANDS: (Island | "Semua")[] = ["Semua", "Jawa", "Madura", "Bali", "Lombok"];

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
  const [commoditySort, setCommoditySort] = useState<CommodityGroupSort>({ key: null, dir: "desc" });

  const onCommoditySort = (key: CommodityGroupSortKey) => {
    setCommoditySort((cur) => {
      if (cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: "desc" };
    });
  };

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
      const aAnom = a.rows.some((r) => r.het_ha != null && r.price_latest != null && r.price_latest > r.het_ha * HET_ANOMALY_THRESHOLD) ? 0 : 1;
      const bAnom = b.rows.some((r) => r.het_ha != null && r.price_latest != null && r.price_latest > r.het_ha * HET_ANOMALY_THRESHOLD) ? 0 : 1;
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
    return sortCommodityGroups([...map.values()], commoditySort);
  }, [filtered, commoditySort]);

  const stats = useMemo(() => {
    const cities = new Set(data.map((r) => r.kode_wilayah));
    const commodities = new Set(data.map((r) => r.commodity_id));
    const latestDate = data.reduce<string | null>((m, r) => (r.date_latest != null && (m == null || r.date_latest > m) ? r.date_latest : m), null);
    const aboveHet = data.filter((r) => r.het_ha != null && r.price_latest != null && r.price_latest > r.het_ha * HET_ANOMALY_THRESHOLD).length;
    return { cities: cities.size, commodities: commodities.size, latestDate, aboveHet };
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <SP2KPHeader stats={stats} view={view} onViewChange={setView} />

      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
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
            className={`fbtn${island === i ? " on" : ""}`}
            onClick={() => { setIsland(i); setProvince("Semua"); }}
          >
            {i}
          </button>
        ))}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-ink-dim font-mono">Provinsi:</span>
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="px-2 py-1 rounded-[6px] border border-rule bg-paper text-[11px] text-ink-mid outline-none"
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

      {view === "city" ? (
        <CityColHeader />
      ) : (
        <CommodityGroupColHeader sort={commoditySort} onSort={onCommoditySort} />
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="empty">
            <div className="empty-title">Memuat data SP2KP...</div>
          </div>
        )}
        {!loading && error && (
          <div className="empty">
            <div className="empty-title text-dn">Gagal memuat</div>
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


