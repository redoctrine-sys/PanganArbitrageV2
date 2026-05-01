"use client";

import { useEffect, useMemo, useState } from "react";
import { CityEditModal } from "./CityEditModal";

interface City {
  id: string;
  kode_wilayah: string | null;
  name: string;
  name_sp2kp: string | null;
  province: string | null;
  island: string | null;
  entity_type: "kota" | "kabupaten" | null;
  lat: number | null;
  lng: number | null;
}

const ISLANDS = ["Semua", "Jawa", "Madura", "Bali", "Lombok"] as const;

function Stat({ label, value, accentClass }: { label: string; value: string; accentClass?: string }) {
  return (
    <div className="sc max-w-[220px]">
      <div className="sc-l">{label}</div>
      <div className={`sc-v ${accentClass ?? ""}`}>{value}</div>
    </div>
  );
}

export function AdminCitiesPage() {
  const [data, setData] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [island, setIsland] = useState<(typeof ISLANDS)[number]>("Semua");
  const [editing, setEditing] = useState<City | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/cities?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) setError(json.error);
      setData((json.data ?? []) as City[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (island !== "Semua" && c.island !== island) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) ||
        (c.kode_wilayah ?? "").toLowerCase().includes(q) ||
        (c.province ?? "").toLowerCase().includes(q);
    });
  }, [data, search, island]);

  const stats = useMemo(() => ({
    total: data.length,
    withCoord: data.filter((c) => c.lat != null && c.lng != null).length,
  }), [data]);

  async function saveCity(patch: Partial<City>) {
    if (!editing) return;
    const res = await fetch(`/api/cities/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) { setToast({ kind: "err", msg: json.error ?? `HTTP ${res.status}` }); throw new Error(json.error); }
    setData((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...json.data } : c)));
    setEditing(null);
    setToast({ kind: "ok", msg: `${json.data.name} tersimpan · lat ${json.data.lat ?? "—"} lng ${json.data.lng ?? "—"}` });
    reload();
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-[#6b7280] shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">Manajemen Kota</div>
            <div className="font-mono text-[10px] text-ink-dim">
              Edit nama display, koordinat lat/lng — referensi untuk Phase 2 cross-source &amp; arbitrase
            </div>
          </div>
        </div>
        <div className="flex gap-[7px]">
          <Stat label="Total Kota" value={stats.total ? String(stats.total) : "—"} />
          <Stat label="Punya Koordinat" value={`${stats.withCoord} / ${stats.total}`}
            accentClass={stats.withCoord < stats.total ? "text-warn" : "text-up"} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
          <input placeholder="Cari kota / kode / provinsi..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {ISLANDS.map((i) => (
          <button key={i} type="button" className={`fbtn${island === i ? " on" : ""}`} onClick={() => setIsland(i)}>{i}</button>
        ))}
        <div className="fhint">{filtered.length} kota</div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="empty"><div className="empty-title">Memuat...</div></div>}
        {!loading && error && <div className="empty"><div className="empty-title text-dn">Gagal memuat</div><div className="empty-sub">{error}</div></div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty">
            <div className="empty-title">Tidak ada kota.</div>
            <div className="empty-sub">Cities di-seed otomatis saat ingest SP2KP. Upload data dulu di tab SP2KP.</div>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th className="w-14">Kode</th><th>Kota</th>
                <th className="w-[140px]">Provinsi</th><th className="w-20">Island</th>
                <th className="w-[90px]">Entity</th>
                <th className="w-[110px]">Lat</th><th className="w-[110px]">Lng</th>
                <th className="w-[70px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const hasCoord = c.lat != null && c.lng != null;
                return (
                  <tr key={c.id}>
                    <td className="mono text-ink-dim">{c.kode_wilayah ?? "—"}</td>
                    <td>
                      <div className="font-medium">{c.name}</div>
                      {c.name_sp2kp && c.name_sp2kp !== c.name && (
                        <div className="text-[10px] text-ink-dim font-mono">SP2KP: {c.name_sp2kp}</div>
                      )}
                    </td>
                    <td className="text-[11px]">{c.province ?? "—"}</td>
                    <td className="text-[11px]">{c.island ?? "—"}</td>
                    <td className="text-[11px]">{c.entity_type ?? "—"}</td>
                    <td className={`mono ${hasCoord ? "" : "text-ink-dim"}`}>{c.lat != null ? c.lat.toFixed(6) : "—"}</td>
                    <td className={`mono ${hasCoord ? "" : "text-ink-dim"}`}>{c.lng != null ? c.lng.toFixed(6) : "—"}</td>
                    <td>
                      <button type="button" className="btn btn-ghost py-[3px] px-[9px] text-[10px]" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && <CityEditModal city={editing} onClose={() => setEditing(null)} onSave={saveCity} />}
      {toast && <div className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-err"}`}>{toast.msg}</div>}
    </div>
  );
}
