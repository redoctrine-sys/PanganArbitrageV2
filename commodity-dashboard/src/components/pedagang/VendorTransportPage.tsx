"use client";

import { useEffect, useMemo, useState } from "react";

type Moda = "truk" | "pickup" | "kapal" | "motor" | "mobil" | "lainnya";
type PricingType = "per_km" | "flat_per_trip";

interface Vendor {
  id: string;
  name: string;
  moda: Moda;
  pricing_type: PricingType;
  price: number;
  capacity_kg: number | null;
  coverage: string | null;
  contact: string | null;
  notes: string | null;
  base_fare_rp: number | null;
  base_km: number | null;
}

const MODA_LABELS: Record<Moda, string> = {
  truk: "🚛 Truk",
  pickup: "🛻 Pickup",
  kapal: "⛴ Kapal",
  motor: "🏍 Motor",
  mobil: "🚗 Mobil",
  lainnya: "📦 Lainnya",
};

const MODA_PILL: Record<Moda, string> = {
  truk: "pill-mid",
  pickup: "pill-lo",
  kapal: "pill-sp",
  motor: "pill-warn",
  mobil: "pill-hi",
  lainnya: "pill-neu",
};

const MODA_FILTERS = ["Semua", "Truk", "Pickup", "Kapal", "Motor", "Mobil", "Lainnya"] as const;

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatPrice(v: Vendor) {
  return v.pricing_type === "per_km" ? `${fmtRp(v.price)}/km` : fmtRp(v.price);
}

function formatPricingType(t: PricingType) {
  return t === "per_km" ? "Per km" : "Flat/trip";
}

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

    const cheapestPerKm = perKm.length > 0
      ? perKm.reduce((min, v) => (v.price < min.price ? v : min), perKm[0])
      : null;

    const cheapestFlat = flat.length > 0
      ? flat.reduce((min, v) => (v.price < min.price ? v : min), flat[0])
      : null;

    const maxCap = data.reduce<number | null>((acc, v) => {
      if (v.capacity_kg == null) return acc;
      return acc == null || v.capacity_kg > acc ? v.capacity_kg : acc;
    }, null);

    const modaCounts = data.reduce<Partial<Record<Moda, number>>>((acc, v) => {
      acc[v.moda] = (acc[v.moda] ?? 0) + 1;
      return acc;
    }, {});

    const kapal = data.filter((v) => v.moda === "kapal");

    return {
      total: data.length,
      perKm: perKm.length,
      flat: flat.length,
      cheapestPerKm,
      cheapestFlat,
      maxCap,
      modaCounts,
      kapalCount: kapal.length,
    };
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div style={{ padding: "12px 18px 9px", background: "#f0ece4", borderBottom: "2px solid var(--rule)", flexShrink: 0 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
          <div style={{ width: 4, height: 22, borderRadius: 3, background: "var(--ped)", flexShrink: 0 }} />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>Vendor Transport</div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Database vendor angkutan · dipakai kalkulasi biaya arbitrase
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex" style={{ gap: 7, flexWrap: "wrap" }}>
          <Stat label="Total Vendor" value={stats.total ? String(stats.total) : "—"} />
          <Stat label="Per-km" value={stats.perKm ? String(stats.perKm) : "—"} />
          <Stat label="Flat/Trip" value={stats.flat ? String(stats.flat) : "—"} />
          <Stat label="⛴ Kapal/Feri" value={stats.kapalCount ? String(stats.kapalCount) : "—"} />
          <Stat
            label="Termurah/km"
            value={stats.cheapestPerKm ? `${fmtRp(stats.cheapestPerKm.price)}/km` : "—"}
            sub={stats.cheapestPerKm?.name}
          />
          <Stat
            label="Termurah Flat"
            value={stats.cheapestFlat ? fmtRp(stats.cheapestFlat.price) : "—"}
            sub={stats.cheapestFlat?.name}
          />
          <Stat
            label="Max Kapasitas"
            value={stats.maxCap != null ? `${stats.maxCap.toLocaleString("id-ID")} kg` : "—"}
          />
        </div>

        {/* Moda breakdown pills */}
        {stats.total > 0 && (
          <div className="flex" style={{ gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            {(Object.entries(stats.modaCounts) as [Moda, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([m, n]) => (
                <span
                  key={m}
                  className={`pill ${MODA_PILL[m] ?? "pill-neu"}`}
                  style={{ fontSize: 9, cursor: "pointer" }}
                  onClick={() => setModaFilter(
                    (m.charAt(0).toUpperCase() + m.slice(1)) as (typeof MODA_FILTERS)[number]
                  )}
                >
                  {MODA_LABELS[m]} · {n}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <div className="fsearch">
          <span style={{ color: "var(--ink-dim)" }}>⌕</span>
          <input
            placeholder="Cari vendor / cakupan / catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {MODA_FILTERS.map((m) => (
          <button
            key={m}
            type="button"
            className={`fbtn ${modaFilter === m ? "on" : ""}`}
            onClick={() => setModaFilter(m)}
          >
            {m === "Semua" ? "🚛 Moda" : m}
            {modaFilter === m && m !== "Semua" ? " ×" : ""}
          </button>
        ))}
        <div className="fhint">{filtered.length} vendor</div>
        <button
          type="button"
          className="btn btn-green"
          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 11px" }}
          onClick={() => setAdding(true)}
        >
          + Tambah Vendor
        </button>
      </div>

      {/* Table + Detail Panel */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <div className="empty"><div className="empty-title">Memuat...</div></div>}
        {!loading && error && (
          <div className="empty">
            <div className="empty-title" style={{ color: "var(--dn)" }}>Gagal memuat</div>
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
          <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 95 }} />
              <col style={{ width: 75 }} />
              <col style={{ width: 155 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Vendor</th>
                <th>Moda</th>
                <th>Tipe</th>
                <th>Harga</th>
                <th>Kapasitas</th>
                <th>Cakupan</th>
                <th>Kontak</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr
                  key={v.id}
                  style={{ cursor: "pointer", background: viewing?.id === v.id ? "var(--paper3)" : undefined }}
                  onClick={() => setViewing((prev) => prev?.id === v.id ? null : v)}
                >
                  <td className="mono" style={{ color: "var(--ink-dim)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {v.name}
                    {v.notes && (
                      <div
                        className="mono"
                        style={{ fontSize: 9, color: "var(--ink-dim)", marginTop: 2, lineHeight: 1.4 }}
                        title={v.notes}
                      >
                        {v.notes.length > 55 ? v.notes.slice(0, 55) + "…" : v.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${MODA_PILL[v.moda] ?? "pill-neu"}`} style={{ fontSize: 9 }}>
                      {MODA_LABELS[v.moda] ?? v.moda}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 10 }}>
                    {formatPricingType(v.pricing_type)}
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: "var(--ped)" }}>
                    {formatPrice(v)}
                    {v.base_fare_rp != null && (
                      <div style={{ fontWeight: 400, fontSize: 9, color: "var(--ink-dim)", marginTop: 2 }}>
                        Dasar {fmtRp(v.base_fare_rp)}
                        {v.base_km != null ? ` / ${v.base_km} km` : ""}
                      </div>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {v.capacity_kg != null ? `${v.capacity_kg.toLocaleString("id-ID")} kg` : "—"}
                  </td>
                  <td style={{ fontSize: 11 }}>{v.coverage ?? "—"}</td>
                  <td style={{ fontSize: 11 }}>{v.contact ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "3px 9px", fontSize: 10 }}
                        onClick={(e) => { e.stopPropagation(); setEditing(v); }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "3px 7px", fontSize: 10, background: "var(--dn-bg)", color: "var(--dn)", border: "1px solid #fecaca" }}
                        onClick={(e) => { e.stopPropagation(); deleteVendor(v); }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Add/Edit modal */}
      {(adding || editing) && (
        <VendorModal
          initial={editing ?? undefined}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSave={(patch) => saveVendor(patch, editing?.id)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-err"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="sc" style={{ maxWidth: 180 }}>
      <div className="sc-l">{label}</div>
      <div className="sc-v">{value}</div>
      {sub && (
        <div className="font-mono" style={{ fontSize: 8, color: "var(--ink-dim)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function VendorModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Vendor;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Vendor, "id">>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [moda, setModa] = useState<Moda>(initial?.moda ?? "truk");
  const [pricingType, setPricingType] = useState<PricingType>(initial?.pricing_type ?? "per_km");
  const [priceStr, setPriceStr] = useState(initial?.price != null ? String(initial.price) : "");
  const [capStr, setCapStr] = useState(initial?.capacity_kg != null ? String(initial.capacity_kg) : "");
  const [baseFareStr, setBaseFareStr] = useState(initial?.base_fare_rp != null ? String(initial.base_fare_rp) : "");
  const [baseKmStr, setBaseKmStr] = useState(initial?.base_km != null ? String(initial.base_km) : "");
  const [coverage, setCoverage] = useState(initial?.coverage ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr("Nama vendor wajib diisi"); return; }
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) { setErr("Harga harus angka positif"); return; }
    const capacity_kg = capStr.trim() ? Number(capStr) : null;
    if (capStr.trim() && !Number.isFinite(capacity_kg as number)) { setErr("Kapasitas harus angka"); return; }
    const base_fare_rp = baseFareStr.trim() ? Number(baseFareStr) : null;
    if (baseFareStr.trim() && !Number.isFinite(base_fare_rp as number)) { setErr("Tarif dasar harus angka"); return; }
    const base_km = baseKmStr.trim() ? Number(baseKmStr) : null;
    if (baseKmStr.trim() && !Number.isFinite(base_km as number)) { setErr("Jarak dasar harus angka"); return; }

    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        moda,
        pricing_type: pricingType,
        price,
        capacity_kg,
        base_fare_rp,
        base_km,
        coverage: coverage.trim() || null,
        contact: contact.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  const isEdit = !!initial;

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-hd">
          <div>
            <div className="font-serif" style={{ fontSize: 14, fontWeight: 700 }}>
              {isEdit ? "Edit Vendor" : "Tambah Vendor Transport"}
            </div>
            {isEdit && (
              <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                {initial?.name}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="modal-bd" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Nama Vendor">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="Truk Pak Budi, Kapal Feri..."
                style={iStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Moda">
                <select value={moda} onChange={(e) => setModa(e.target.value as Moda)} disabled={busy} style={iStyle}>
                  <option value="truk">🚛 Truk</option>
                  <option value="pickup">🛻 Pickup</option>
                  <option value="kapal">⛴ Kapal</option>
                  <option value="motor">🏍 Motor</option>
                  <option value="mobil">🚗 Mobil</option>
                  <option value="lainnya">📦 Lainnya</option>
                </select>
              </Field>
              <Field label="Tipe Harga">
                <select value={pricingType} onChange={(e) => setPricingType(e.target.value as PricingType)} disabled={busy} style={iStyle}>
                  <option value="per_km">Per km (Rp/km)</option>
                  <option value="flat_per_trip">Flat per trip</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={pricingType === "per_km" ? "Harga (Rp/km)" : "Harga Flat (Rp/trip)"}>
                <input
                  type="number"
                  min={0}
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  disabled={busy}
                  placeholder={pricingType === "per_km" ? "2000" : "2500000"}
                  style={{ ...iStyle, fontFamily: "var(--font-mono)" }}
                />
              </Field>
              <Field label="Kapasitas (kg)">
                <input
                  type="number"
                  min={0}
                  value={capStr}
                  onChange={(e) => setCapStr(e.target.value)}
                  disabled={busy}
                  placeholder="8000"
                  style={{ ...iStyle, fontFamily: "var(--font-mono)" }}
                />
              </Field>
            </div>

            {pricingType === "per_km" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Tarif Dasar (Rp)">
                  <input
                    type="number"
                    min={0}
                    value={baseFareStr}
                    onChange={(e) => setBaseFareStr(e.target.value)}
                    disabled={busy}
                    placeholder="8000"
                    style={{ ...iStyle, fontFamily: "var(--font-mono)" }}
                  />
                </Field>
                <Field label="Jarak Dasar (Km)">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={baseKmStr}
                    onChange={(e) => setBaseKmStr(e.target.value)}
                    disabled={busy}
                    placeholder="3"
                    style={{ ...iStyle, fontFamily: "var(--font-mono)" }}
                  />
                </Field>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Cakupan Wilayah">
                <input
                  type="text"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  disabled={busy}
                  placeholder="Jawa · Madura"
                  style={iStyle}
                />
              </Field>
              <Field label="Kontak">
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={busy}
                  placeholder="08xx..."
                  style={iStyle}
                />
              </Field>
            </div>

            <Field label="Catatan (opsional)">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
                placeholder="Info tambahan, kondisi tarif, dll."
                style={iStyle}
              />
            </Field>

            {err && (
              <div className="anom-bar danger" style={{ borderRadius: 6, fontSize: 11 }}>
                ⚠ <span>{err}</span>
              </div>
            )}
          </div>

          <div className="modal-ft">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="btn btn-green" disabled={busy}>
              {busy ? "Menyimpan..." : (isEdit ? "Simpan Perubahan" : "Tambah Vendor")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".9px", textTransform: "uppercase", color: "var(--ink-dim)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function VendorDetailPanel({
  vendor,
  onClose,
  onEdit,
  onDelete,
}: {
  vendor: Vendor;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [jarakStr, setJarakStr] = useState("");

  const costCalc = useMemo(() => {
    if (vendor.pricing_type !== "per_km") return null;
    const km = parseFloat(jarakStr);
    if (!Number.isFinite(km) || km <= 0) return null;

    let cost: number;
    let breakdown: string;

    if (vendor.base_fare_rp != null && vendor.base_km != null) {
      if (km <= vendor.base_km) {
        cost = vendor.base_fare_rp;
        breakdown = `≤ ${vendor.base_km} km → tarif minimum berlaku`;
      } else {
        const extra = km - vendor.base_km;
        cost = vendor.base_fare_rp + extra * vendor.price;
        breakdown = `${fmtRp(vendor.base_fare_rp)} + ${extra.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km × ${fmtRp(vendor.price)}/km`;
      }
    } else {
      cost = km * vendor.price;
      breakdown = `${km.toLocaleString("id-ID")} km × ${fmtRp(vendor.price)}/km`;
    }

    const costPerKg = vendor.capacity_kg ? Math.round(cost / vendor.capacity_kg) : null;
    return { cost: Math.round(cost), breakdown, costPerKg };
  }, [vendor, jarakStr]);

  return (
    <div style={{
      width: 278,
      flexShrink: 0,
      borderLeft: "2px solid var(--rule)",
      background: "var(--paper)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{ padding: "11px 14px 10px", borderBottom: "1px solid var(--rule)", background: "#f0ece4", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <span className={`pill ${MODA_PILL[vendor.moda] ?? "pill-neu"}`} style={{ fontSize: 9 }}>
            {MODA_LABELS[vendor.moda] ?? vendor.moda}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "2px 7px", fontSize: 11 }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="font-serif" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
          {vendor.name}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 13 }}>

        {/* Harga */}
        <DetailSection label="Harga">
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--ped)" }}>
            {formatPrice(vendor)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 1 }}>
            {vendor.pricing_type === "per_km" ? "Per kilometer" : "Flat per trip"}
          </div>
          {vendor.base_fare_rp != null && (
            <div style={{ marginTop: 7, padding: "7px 9px", background: "var(--paper3)", borderRadius: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "var(--ink-dim)", marginBottom: 3 }}>
                Tarif Dasar
              </div>
              <div className="mono" style={{ fontSize: 12 }}>
                {fmtRp(vendor.base_fare_rp)}
                {vendor.base_km != null && (
                  <span style={{ color: "var(--ink-dim)", fontWeight: 400 }}>
                    {" "}/ {vendor.base_km} km pertama
                  </span>
                )}
              </div>
            </div>
          )}
        </DetailSection>

        {/* Kapasitas */}
        {vendor.capacity_kg != null && (
          <DetailSection label="Kapasitas">
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
              {vendor.capacity_kg.toLocaleString("id-ID")} kg
            </span>
          </DetailSection>
        )}

        {/* Flat cost/kg */}
        {vendor.pricing_type === "flat_per_trip" && vendor.capacity_kg != null && (
          <DetailSection label="Estimasi Cost/kg (muatan penuh)">
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ped)" }}>
              {fmtRp(Math.round(vendor.price / vendor.capacity_kg))}/kg
            </span>
            <div style={{ fontSize: 9, color: "var(--ink-dim)", marginTop: 2 }}>
              {fmtRp(vendor.price)} ÷ {vendor.capacity_kg.toLocaleString("id-ID")} kg
            </div>
          </DetailSection>
        )}

        {/* Cakupan */}
        {vendor.coverage && (
          <DetailSection label="Cakupan Wilayah">
            <span style={{ fontSize: 12 }}>{vendor.coverage}</span>
          </DetailSection>
        )}

        {/* Kontak */}
        {vendor.contact && (
          <DetailSection label="Kontak">
            <span style={{ fontSize: 12 }}>{vendor.contact}</span>
          </DetailSection>
        )}

        {/* Catatan */}
        {vendor.notes && (
          <DetailSection label="Catatan">
            <span style={{ fontSize: 11, color: "var(--ink-mid)", lineHeight: 1.6 }}>
              {vendor.notes}
            </span>
          </DetailSection>
        )}

        {/* Cost Calculator (per_km only) */}
        {vendor.pricing_type === "per_km" && (
          <div style={{ padding: "10px 11px", background: "var(--paper3)", borderRadius: 8, border: "1px solid var(--rule)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "var(--ink-dim)", marginBottom: 8 }}>
              Estimasi Biaya
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                min={0}
                step="1"
                value={jarakStr}
                onChange={(e) => setJarakStr(e.target.value)}
                placeholder="Jarak km..."
                style={{ ...panelInputStyle, flex: 1 }}
              />
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-dim)", flexShrink: 0 }}>km</span>
            </div>
            {costCalc ? (
              <div style={{ marginTop: 9 }}>
                <div style={{ fontSize: 9, color: "var(--ink-dim)", marginBottom: 4, lineHeight: 1.5 }}>
                  {costCalc.breakdown}
                </div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--ped)" }}>
                  {fmtRp(costCalc.cost)}
                </div>
                {costCalc.costPerKg != null && (
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
                    ≈ {fmtRp(costCalc.costPerKg)}/kg{" "}
                    <span style={{ fontFamily: "var(--font-sans)" }}>
                      (muatan penuh {vendor.capacity_kg?.toLocaleString("id-ID")} kg)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              jarakStr && <div style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 6 }}>Masukkan jarak valid</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)", display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ flex: 1, fontSize: 11, padding: "5px" }}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn"
          style={{ flex: 1, fontSize: 11, padding: "5px", background: "var(--dn-bg)", color: "var(--dn)", border: "1px solid #fecaca" }}
          onClick={onDelete}
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "var(--ink-dim)", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const panelInputStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid var(--rule)",
  background: "var(--paper)",
  fontSize: 11,
  color: "var(--ink)",
  outline: "none",
  fontFamily: "var(--font-mono)",
  width: "100%",
};

const iStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--rule)",
  background: "var(--paper)",
  fontSize: 12,
  color: "var(--ink)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  width: "100%",
};
