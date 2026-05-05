"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";

// ─── Types ───────────────────────────────────────────────────────────
interface PedagangPrice {
  id: string;
  date: string;
  city_raw: string;
  commodity_raw: string;
  price: number;
  source: string;
  created_at: string;
}

interface PedagangStats {
  total: number;
  commodities: number;
  cities: number;
  latestDate: string | null;
  uniqueCommodities: string[];
  uniqueCities: string[];
}

interface PedagangResponse {
  data: PedagangPrice[];
  stats: PedagangStats;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function fmtRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Baru saja";
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

// ─── Stat card ───────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="sc max-w-[180px]">
      <div className="sc-l">{label}</div>
      <div className="sc-v">{value}</div>
      {sub && (
        <div className="font-mono text-[8px] text-ink-dim mt-px overflow-hidden text-ellipsis whitespace-nowrap">
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function HargaPedagangPage() {
  const [search, setSearch] = useState("");
  const [commodityFilter, setCommodityFilter] = useState("Semua");
  const [cityFilter, setCityFilter] = useState("Semua");

  const { data: resp, isLoading, error: fetchError } = useSWR<PedagangResponse>(
    "/api/pedagang/prices?days=30",
    fetcher,
    { refreshInterval: 60000 } // refresh every minute
  );

  const rows = resp?.data ?? [];
  const stats = resp?.stats ?? { total: 0, commodities: 0, cities: 0, latestDate: null, uniqueCommodities: [], uniqueCities: [] };
  const error = fetchError?.message ?? resp?.error ?? null;

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (commodityFilter !== "Semua" && r.commodity_raw !== commodityFilter) return false;
      if (cityFilter !== "Semua" && r.city_raw !== cityFilter) return false;
      if (!q) return true;
      return (
        r.commodity_raw.toLowerCase().includes(q) ||
        r.city_raw.toLowerCase().includes(q) ||
        String(r.price).includes(q)
      );
    });
  }, [rows, search, commodityFilter, cityFilter]);

  // Group by commodity for pills
  const commodityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.commodity_raw] = (counts[r.commodity_raw] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // Price range per commodity
  const priceRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number; avg: number; count: number }> = {};
    rows.forEach((r) => {
      if (!ranges[r.commodity_raw]) {
        ranges[r.commodity_raw] = { min: r.price, max: r.price, avg: r.price, count: 1 };
      } else {
        const rng = ranges[r.commodity_raw];
        rng.min = Math.min(rng.min, r.price);
        rng.max = Math.max(rng.max, r.price);
        rng.avg = (rng.avg * rng.count + r.price) / (rng.count + 1);
        rng.count++;
      }
    });
    return ranges;
  }, [rows]);

  const hasData = rows.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-ped shrink-0" />
          <div className="flex-1">
            <div className="font-serif text-[15px] font-bold">Harga Pedagang</div>
            <div className="font-mono text-[10px] text-ink-dim">
              Data harga lapangan dari pedagang pasar · Sumber: Chrome Extension (Facebook groups)
            </div>
          </div>
          <span className="pill bg-[#dcfce7] text-[#1b5e3b] text-[9px]">
            📡 Live
          </span>
        </div>
        <div className="flex gap-[7px] flex-wrap">
          <Stat label="Total Data" value={hasData ? String(stats.total) : "—"} />
          <Stat label="Komoditas" value={hasData ? String(stats.commodities) : "—"} />
          <Stat label="Kota" value={hasData ? String(stats.cities) : "—"} />
          <Stat
            label="Update Terakhir"
            value={stats.latestDate ? fmtDate(stats.latestDate) : "—"}
          />
        </div>

        {/* Commodity pills */}
        {commodityCounts.length > 0 && (
          <div className="flex gap-[5px] mt-[7px] flex-wrap">
            <span
              className={`pill text-[9px] cursor-pointer ${
                commodityFilter === "Semua" ? "bg-ink text-paper" : "pill-neu"
              }`}
              onClick={() => setCommodityFilter("Semua")}
            >
              Semua · {rows.length}
            </span>
            {commodityCounts.slice(0, 12).map(([name, count]) => (
              <span
                key={name}
                className={`pill text-[9px] cursor-pointer ${
                  commodityFilter === name ? "bg-ink text-paper" : "pill-neu"
                }`}
                onClick={() =>
                  setCommodityFilter((prev) => (prev === name ? "Semua" : name))
                }
              >
                {name} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
          <input
            placeholder="Cari komoditas / kota / harga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {stats.uniqueCities.length > 1 && (
          <select
            className="text-[11px] border border-rule rounded px-2 py-[3px] bg-paper font-mono"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option value="Semua">🏙 Semua Kota</option>
            {stats.uniqueCities.sort().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <div className="fhint">{filtered.length} data harga</div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="empty">
            <div className="empty-title">Memuat data harga pedagang...</div>
          </div>
        )}
        {!isLoading && error && (
          <div className="empty">
            <div className="empty-title text-dn">Gagal memuat</div>
            <div className="empty-sub">{error}</div>
          </div>
        )}

        {/* Empty state — no data yet */}
        {!isLoading && !error && !hasData && (
          <div className="empty">
            <div className="text-[28px] mb-2">📡</div>
            <div className="empty-title">Belum ada data harga pedagang</div>
            <div className="empty-sub max-w-[400px] mx-auto">
              Instal <b>PanganScraper Chrome Extension</b>, browse Facebook groups pedagang,
              lalu accept harga yang ter-capture. Data akan muncul di sini otomatis.
            </div>
            <div className="mt-3 flex flex-col gap-1 text-[11px] text-ink-dim">
              <span>1. Load extension di <code>chrome://extensions</code></span>
              <span>2. Set Gemini API key + API URL</span>
              <span>3. Browse Facebook groups pedagang pasar</span>
              <span>4. Review & accept captured prices di popup</span>
            </div>
          </div>
        )}

        {/* Price summary cards by commodity */}
        {!isLoading && !error && hasData && Object.keys(priceRanges).length > 0 && commodityFilter === "Semua" && !search && (
          <div className="px-4 py-3 flex gap-3 flex-wrap border-b border-rule bg-[#fafaf8]">
            {Object.entries(priceRanges)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 8)
              .map(([name, rng]) => (
                <div
                  key={name}
                  className="bg-paper border border-rule rounded-lg px-3 py-2 min-w-[140px] cursor-pointer hover:border-[#1b5e3b] transition-colors"
                  onClick={() => setCommodityFilter(name)}
                >
                  <div className="text-[11px] font-semibold truncate">{name}</div>
                  <div className="font-mono text-[13px] font-bold text-[#1b5e3b]">
                    {fmtRp(Math.round(rng.avg))}
                    <span className="text-[9px] text-ink-dim font-normal">/kg</span>
                  </div>
                  <div className="text-[9px] text-ink-dim font-mono mt-[2px]">
                    {fmtRp(rng.min)} – {fmtRp(rng.max)} · {rng.count} data
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Data table */}
        {!isLoading && !error && hasData && (
          <table
            className="preview-table"
            style={{ tableLayout: "fixed", width: "100%" }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Tanggal</th>
                <th>Komoditas</th>
                <th>Kota</th>
                <th>Harga</th>
                <th>Waktu Capture</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td className="mono text-ink-dim">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="mono text-[11px]">{fmtDate(r.date)}</td>
                  <td className="font-medium text-[12px]">
                    {r.commodity_raw}
                  </td>
                  <td className="text-[11px]">📍 {r.city_raw}</td>
                  <td className="mono font-semibold text-[#1b5e3b]">
                    {fmtRp(r.price)}/kg
                  </td>
                  <td className="text-[10px] text-ink-dim">
                    {relativeTime(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* No results for filter */}
        {!isLoading && !error && hasData && filtered.length === 0 && (
          <div className="empty">
            <div className="empty-title">Tidak ditemukan</div>
            <div className="empty-sub">
              Coba ubah filter atau kata kunci pencarian.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
