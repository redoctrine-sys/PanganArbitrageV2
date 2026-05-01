"use client";

import { useEffect, useMemo, useState } from "react";
import { VendorModal } from "./VendorModal";
import { VendorDetailPanel } from "./VendorDetailPanel";
import {
  fmtRp, formatPrice, formatPricingType,
  MODA_FILTERS, MODA_LABELS, MODA_PILL,
  type Moda, type Vendor,
} from "./vendor.types";

/* ── Stat card (local to page header) ── */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="sc max-w-[180px]">
      <div className="sc-l">{label}</div>
      <div className="sc-v">{value}</div>
      {sub && <div className="font-mono text-[8px] text-ink-dim mt-px overflow-hidden text-ellipsis whitespace-nowrap">{sub}</div>}
    </div>
  );
}

/* ── Main page ── */
export function VendorTransportPage() {
  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modaFilter, setModaFilter] = useState<(typeof MODA_FILTERS)[number]>("Semua");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [viewing, setViewing] = useState<Vendor | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transport-vendors?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) setError(json.error);
      setData((json.data ?? []) as Vendor[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((v) => {
      if (modaFilter !== "Semua" && v.moda !== modaFilter.toLowerCase()) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.coverage ?? "").toLowerCase().includes(q) ||
        (v.contact ?? "").toLowerCase().includes(q) ||
        (v.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, modaFilter]);

  async function saveVendor(patch: Partial<Omit<Vendor, "id">>, id?: string) {
    let res: Response;
    try {
      res = await fetch(id ? `/api/transport-vendors/${id}` : "/api/transport-vendors", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setToast({ kind: "err", msg });
      throw e;
    }
    const json = await res.json();
    if (!res.ok) {
      const msg = json.error ?? `HTTP ${res.status}`;
      setToast({ kind: "err", msg });
      throw new Error(msg);
    }
    if (id) {
      setData((prev) => prev.map((v) => (v.id === id ? { ...v, ...json.data } : v)));
      setViewing((prev) => (prev?.id === id ? { ...prev, ...(json.data as Vendor) } : prev));
    } else {
      setData((prev) => [...prev, json.data as Vendor]);
    }
    setEditing(null);
    setAdding(false);
    setToast({ kind: "ok", msg: `${json.data.name} tersimpan` });
    reload();
  }

  async function deleteVendor(v: Vendor) {
    if (!confirm(`Hapus vendor "${v.name}"?`)) return;
    let res: Response;
    try {
      res = await fetch(`/api/transport-vendors/${v.id}`, { method: "DELETE" });
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : "Network error" });
      return;
    }
    if (!res.ok) {
      const json = await res.json();
      setToast({ kind: "err", msg: json.error ?? "Gagal menghapus" });
      return;
    }
    setData((prev) => prev.filter((x) => x.id !== v.id));
    setViewing((prev) => (prev?.id === v.id ? null : prev));
    setToast({ kind: "ok", msg: `${v.name} dihapus` });
  }

  const stats = useMemo(() => {
    const perKm = data.filter((v) => v.pricing_type === "per_km");
    const flat = data.filter((v) => v.pricing_type === "flat_per_trip");
    const cheapestPerKm = perKm.length > 0 ? perKm.reduce((min, v) => (v.price < min.price ? v : min), perKm[0]) : null;
    const cheapestFlat = flat.length > 0 ? flat.reduce((min, v) => (v.price < min.price ? v : min), flat[0]) : null;
    const maxCap = data.reduce<number | null>((acc, v) => {
      if (v.capacity_kg == null) return acc;
      return acc == null || v.capacity_kg > acc ? v.capacity_kg : acc;
    }, null);
    const modaCounts = data.reduce<Partial<Record<Moda, number>>>((acc, v) => {
      acc[v.moda] = (acc[v.moda] ?? 0) + 1;
      return acc;
    }, {});
    return { total: data.length, perKm: perKm.length, flat: flat.length, cheapestPerKm, cheapestFlat, maxCap, modaCounts, kapalCount: data.filter((v) => v.moda === "kapal").length };
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-ped shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">Vendor Transport</div>
            <div className="font-mono text-[10px] text-ink-dim">Database vendor angkutan · dipakai kalkulasi biaya arbitrase</div>
          </div>
        </div>
        <div className="flex gap-[7px] flex-wrap">
          <Stat label="Total Vendor"  value={stats.total        ? String(stats.total)        : "—"} />
          <Stat label="Per-km"        value={stats.perKm        ? String(stats.perKm)        : "—"} />
          <Stat label="Flat/Trip"     value={stats.flat         ? String(stats.flat)         : "—"} />
          <Stat label="⛴ Kapal/Feri" value={stats.kapalCount   ? String(stats.kapalCount)   : "—"} />
          <Stat label="Termurah/km"   value={stats.cheapestPerKm ? `${fmtRp(stats.cheapestPerKm.price)}/km` : "—"} sub={stats.cheapestPerKm?.name} />
          <Stat label="Termurah Flat" value={stats.cheapestFlat  ? fmtRp(stats.cheapestFlat.price) : "—"}  sub={stats.cheapestFlat?.name} />
          <Stat label="Max Kapasitas" value={stats.maxCap != null ? `${stats.maxCap.toLocaleString("id-ID")} kg` : "—"} />
        </div>
        {stats.total > 0 && (
          <div className="flex gap-[5px] mt-[7px] flex-wrap">
            {(Object.entries(stats.modaCounts) as [Moda, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => (
                <span
                  key={m}
                  className={`pill text-[9px] cursor-pointer ${MODA_PILL[m] ?? "pill-neu"}`}
                  onClick={() => setModaFilter((m.charAt(0).toUpperCase() + m.slice(1)) as (typeof MODA_FILTERS)[number])}
                >
                  {MODA_LABELS[m]} · {n}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
          <input placeholder="Cari vendor / cakupan / catatan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {MODA_FILTERS.map((m) => (
          <button key={m} type="button" className={`fbtn${modaFilter === m ? " on" : ""}`} onClick={() => setModaFilter(m)}>
            {m === "Semua" ? "🚛 Moda" : m}{modaFilter === m && m !== "Semua" ? " ×" : ""}
          </button>
        ))}
        <div className="fhint">{filtered.length} vendor</div>
        <button type="button" className="btn btn-green ml-auto text-[11px] px-[11px] py-[5px]" onClick={() => setAdding(true)}>+ Tambah Vendor</button>
      </div>

      {/* ── Table + Detail Panel ── */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="empty"><div className="empty-title">Memuat...</div></div>}
          {!loading && error && (
            <div className="empty">
              <div className="empty-title text-dn">Gagal memuat</div>
              <div className="empty-sub">{error}</div>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="empty">
              <div className="empty-title">Belum ada vendor.</div>
              <div className="empty-sub">Klik &ldquo;+ Tambah Vendor&rdquo; untuk menambahkan vendor transportasi.</div>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <VendorTable
              vendors={filtered}
              viewing={viewing}
              onView={(v) => setViewing((prev) => prev?.id === v.id ? null : v)}
              onEdit={setEditing}
              onDelete={deleteVendor}
            />
          )}
        </div>
        {viewing && (
          <VendorDetailPanel
            vendor={viewing}
            onClose={() => setViewing(null)}
            onEdit={() => setEditing(viewing)}
            onDelete={() => deleteVendor(viewing)}
          />
        )}
      </div>

      {/* ── Modals & Toast ── */}
      {(adding || editing) && (
        <VendorModal
          initial={editing ?? undefined}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSave={(patch) => saveVendor(patch, editing?.id)}
        />
      )}
      {toast && <div className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-err"}`}>{toast.msg}</div>}
    </div>
  );
}

/* ── Vendor table (inline sub-component) ── */
function VendorTable({
  vendors, viewing, onView, onEdit, onDelete,
}: {
  vendors: Vendor[];
  viewing: Vendor | null;
  onView: (v: Vendor) => void;
  onEdit: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
}) {
  return (
    <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
      <colgroup>
        <col style={{ width: 36 }} /><col />
        <col style={{ width: 95 }} /><col style={{ width: 75 }} />
        <col style={{ width: 155 }} /><col style={{ width: 95 }} />
        <col style={{ width: 130 }} /><col style={{ width: 100 }} />
        <col style={{ width: 80 }} />
      </colgroup>
      <thead>
        <tr>
          <th>#</th><th>Nama Vendor</th><th>Moda</th><th>Tipe</th>
          <th>Harga</th><th>Kapasitas</th><th>Cakupan</th><th>Kontak</th><th></th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v, i) => (
          <tr
            key={v.id}
            className={`cursor-pointer${viewing?.id === v.id ? " bg-paper-3" : ""}`}
            onClick={() => onView(v)}
          >
            <td className="mono text-ink-dim">{String(i + 1).padStart(2, "0")}</td>
            <td className="font-medium">
              {v.name}
              {v.notes && (
                <div className="font-mono text-[9px] text-ink-dim mt-[2px] leading-[1.4]" title={v.notes}>
                  {v.notes.length > 55 ? v.notes.slice(0, 55) + "…" : v.notes}
                </div>
              )}
            </td>
            <td><span className={`pill ${MODA_PILL[v.moda] ?? "pill-neu"}`}>{MODA_LABELS[v.moda] ?? v.moda}</span></td>
            <td className="mono text-[10px]">{formatPricingType(v.pricing_type)}</td>
            <td className="mono font-semibold text-ped">
              {formatPrice(v)}
              {v.base_fare_rp != null && (
                <div className="font-normal text-[9px] text-ink-dim mt-[2px]">
                  Dasar {fmtRp(v.base_fare_rp)}{v.base_km != null ? ` / ${v.base_km} km` : ""}
                </div>
              )}
            </td>
            <td className="mono text-[11px]">{v.capacity_kg != null ? `${v.capacity_kg.toLocaleString("id-ID")} kg` : "—"}</td>
            <td className="text-[11px]">{v.coverage ?? "—"}</td>
            <td className="text-[11px]">{v.contact ?? "—"}</td>
            <td>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost px-[9px] py-[3px] text-[10px]"
                  onClick={(e) => { e.stopPropagation(); onEdit(v); }}>Edit</button>
                <button type="button" className="btn px-[7px] py-[3px] text-[10px] bg-dn-bg text-dn border border-[#fecaca]"
                  onClick={(e) => { e.stopPropagation(); onDelete(v); }}>✕</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
