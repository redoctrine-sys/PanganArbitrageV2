"use client";

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
import { ScrapeButton } from "@/components/scraper/ScrapeButton";

const ISLANDS: (Island | "Lainnya" | "Semua")[] = ["Semua", "Jawa", "Madura", "Bali", "Lombok", "Lainnya"];

const PIHPS_CONFIG: SourceConfig = {
  title: "PIHPS — Pusat Informasi Harga Pangan Strategis",
  subtitle:
    "Bank Indonesia · bi.go.id/hargapangan · Cross-check vs SP2KP (agensi & metodologi berbeda)",
  accentClass: "bg-[#0369a1]",
  showAnomalyStat: false,
};

export function PIHPSPage() {
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

  const swrKey = island !== "Semua"
    ? `/api/pihps/latest?island=${encodeURIComponent(island)}`
    : "/api/pihps/latest";
  const { data: resp, isLoading, error: fetchError } = useSWR<{ data?: SP2KPLatestRow[]; error?: string }>(swrKey, fetcher);
  const data = resp?.data ?? [];
  const loading = isLoading;
  const error = fetchError?.message ?? resp?.error ?? null;

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
    return [...map.values()].sort((a, b) => a.city_raw.localeCompare(b.city_raw));
  }, [filtered]);

  const commodityGroups = useMemo<CommodityGroup[]>(() => {
    const map = new Map<string, CommodityGroup>();
    for (const r of filtered) {
      // PIHPS commodity_id may be null (no match in commodities table) — fallback to name
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
      <SP2KPHeader stats={stats} view={view} onViewChange={setView} config={PIHPS_CONFIG} />

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
        <div className="fhint flex-1">
          {view === "city"
            ? "Klik kota → komoditas · Klik komoditas → chart · Sumber: BI"
            : "Klik komoditas → kota · Klik kota → chart · Sumber: BI"}
        </div>
        <ScrapeButton agent="pihps" />
      </div>

      {view === "city" ? (
        <CityColHeader />
      ) : (
        <CommodityGroupColHeader sort={commoditySort} onSort={onCommoditySort} />
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="empty">
            <div className="empty-title">Memuat data PIHPS...</div>
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
            <div className="empty-title">Belum ada data PIHPS.</div>
            <div className="empty-sub">
              Jalankan scraper di repo <code className="font-mono">pangan-scraper</code>:{" "}
              <code className="font-mono text-[11px]">npm run scrape:pihps</code>
              <br />
              Data otomatis tampil setelah scrape selesai (source = &ldquo;pihps&rdquo; di prices_raw).
            </div>
          </div>
        )}
        {!loading && !error && view === "commodity" && commodityGroups.length === 0 && (
          <div className="empty">
            <div className="empty-title">Belum ada data PIHPS.</div>
            <div className="empty-sub">
              Jalankan scraper di repo <code className="font-mono">pangan-scraper</code>.
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
            source="pihps"
          />
        ))}
        {!loading && !error && view === "commodity" && commodityGroups.map((g, i) => (
          <CommodityGroupRow
            key={g.commodity_id}
            group={g}
            index={i}
            isOpen={openCommodity === g.commodity_id}
            onToggle={() => setOpenCommodity((cur) => (cur === g.commodity_id ? null : g.commodity_id))}
            source="pihps"
          />
        ))}
      </div>
    </div>
  );
}
