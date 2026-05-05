"use client";

// Harga Pedagang — data harga lapangan dari Facebook pedagang groups.
// Uses same SP2KP visual components (By City / By Commodity / Chart).
// Unlike SP2KP, commodities are dynamic (not fixed 17) and data may be sparse.

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";
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
import { SP2KPHeader, type View, type SourceConfig } from "@/components/sp2kp/SP2KPHeader";

const ISLANDS: (Island | "Lainnya" | "Semua")[] = ["Semua", "Jawa", "Madura", "Bali", "Lombok", "Lainnya"];

const PEDAGANG_CONFIG: SourceConfig = {
  title: "Harga Pedagang — Data Lapangan",
  subtitle:
    "Sumber: Chrome Extension (Facebook groups) · Komoditas dinamis · Cross-check vs SP2KP & PIHPS",
  accentClass: "bg-ped",
  cityLabel: "Kota",
  showAnomalyStat: false,
};

export default function HargaPedagangPage() {
  const [view, setView] = useState<View>("city");
  const [island, setIsland] = useState<Island | "Lainnya" | "Semua">("Semua");
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

  // Fetch data from the aggregation API
  const { data: resp, isLoading, error: fetchError } = useSWR<{ data?: SP2KPLatestRow[]; error?: string }>(
    "/api/pedagang/latest",
    fetcher,
    { refreshInterval: 60000 }
  );
  const data = resp?.data ?? [];
  const loading = isLoading;
  const error = fetchError?.message ?? resp?.error ?? null;

  // Filter by island
  const islandFiltered = useMemo(() => {
    if (island === "Semua") return data;
    return data.filter((r) => r.island === island);
  }, [data, island]);

  // Provinces from current island
  const provinces = useMemo(() => {
    const set = new Set<string>();
    for (const r of islandFiltered) if (r.province && r.province !== "—") set.add(r.province);
    return ["Semua", ...[...set].sort()];
  }, [islandFiltered]);

  // Filter by province + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return islandFiltered.filter((r) => {
      if (province !== "Semua" && r.province !== province) return false;
      if (!q) return true;
      return (
        r.city_raw.toLowerCase().includes(q) ||
        r.commodity_name.toLowerCase().includes(q) ||
        (r.province && r.province.toLowerCase().includes(q))
      );
    });
  }, [islandFiltered, province, search]);

  // Group by city
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
    return [...map.values()].sort((a, b) => a.city_raw.localeCompare(b.city_raw));
  }, [filtered]);

  // Group by commodity
  const commodityGroups = useMemo<CommodityGroup[]>(() => {
    const map = new Map<string, CommodityGroup>();
    for (const r of filtered) {
      const key = r.commodity_id ?? r.commodity_name;
      let g = map.get(key);
      if (!g) {
        g = {
          commodity_id: key,
          commodity_name: r.commodity_name,
          category: r.category,
          unit: r.unit,
          rows: [],
        };
        map.set(key, g);
      }
      g.rows.push(r);
    }
    return sortCommodityGroups([...map.values()], commoditySort);
  }, [filtered, commoditySort]);

  // Stats
  const stats = useMemo(() => {
    const cities = new Set(data.map((r) => r.kode_wilayah));
    const commodities = new Set(data.map((r) => r.commodity_id ?? r.commodity_name));
    const latestDate = data.reduce<string | null>(
      (m, r) => (r.date_latest != null && (m == null || r.date_latest > m) ? r.date_latest : m),
      null,
    );
    return { cities: cities.size, commodities: commodities.size, latestDate, aboveHet: 0 };
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <SP2KPHeader stats={stats} view={view} onViewChange={setView} config={PEDAGANG_CONFIG} />

      {/* Filter bar */}
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
        {provinces.length > 2 && (
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
        )}
        <div className="fhint">
          {view === "city"
            ? `${cityGroups.length} kota · Klik kota → komoditas · Sumber: Facebook`
            : `${commodityGroups.length} komoditas · Klik komoditas → kota · Sumber: Facebook`}
        </div>
      </div>

      {/* Column headers */}
      {data.length > 0 && (
        view === "city" ? (
          <CityColHeader />
        ) : (
          <CommodityGroupColHeader sort={commoditySort} onSort={onCommoditySort} />
        )
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="empty">
            <div className="empty-title">Memuat data harga pedagang...</div>
          </div>
        )}
        {!loading && error && (
          <div className="empty">
            <div className="empty-title text-dn">Gagal memuat</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data.length === 0 && (
          <div className="empty">
            <div className="text-[28px] mb-2">📡</div>
            <div className="empty-title">Belum ada data harga pedagang</div>
            <div className="empty-sub max-w-[420px] mx-auto">
              Instal <b>PanganScraper Chrome Extension</b>, browse Facebook groups pedagang,
              lalu accept harga yang ter-capture. Data akan muncul di sini dengan tampilan By City / By Commodity + Chart.
            </div>
            <div className="mt-3 flex flex-col gap-1 text-[11px] text-ink-dim">
              <span>1. Load extension di <code className="font-mono">chrome://extensions</code></span>
              <span>2. Set Gemini API key + API URL di popup</span>
              <span>3. Browse Facebook groups pedagang pasar</span>
              <span>4. Review &amp; accept captured prices di popup</span>
            </div>
          </div>
        )}

        {/* No results for current filter */}
        {!loading && !error && data.length > 0 && filtered.length === 0 && (
          <div className="empty">
            <div className="empty-title">Tidak ditemukan</div>
            <div className="empty-sub">Coba ubah filter atau kata kunci pencarian.</div>
          </div>
        )}

        {/* By City view */}
        {!loading && !error && view === "city" && cityGroups.map((g, i) => (
          <CityRow
            key={g.kode_wilayah}
            group={g}
            index={i}
            isOpen={openCity === g.kode_wilayah}
            onToggle={() => setOpenCity((cur) => (cur === g.kode_wilayah ? null : g.kode_wilayah))}
            source="facebook"
          />
        ))}

        {/* By Commodity view */}
        {!loading && !error && view === "commodity" && commodityGroups.map((g, i) => (
          <CommodityGroupRow
            key={g.commodity_id}
            group={g}
            index={i}
            isOpen={openCommodity === g.commodity_id}
            onToggle={() => setOpenCommodity((cur) => (cur === g.commodity_id ? null : g.commodity_id))}
            source="facebook"
          />
        ))}
      </div>
    </div>
  );
}
