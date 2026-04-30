"use client";

import { useEffect, useMemo, useState } from "react";

type Moda = "truk" | "pickup" | "kapal" | "motor" | "lainnya";
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
}

const MODA_LABELS: Record<Moda, string> = {
  truk: "🚛 Truk",
  pickup: "🛻 Pickup",
  kapal: "⛴ Kapal",
  motor: "🏍 Motor",
  lainnya: "📦 Lainnya",
};

const MODA_PILL: Record<Moda, string> = {
  truk: "pill-mid",
  pickup: "pill-lo",
  kapal: "pill-sp",
  motor: "pill-warn",
  lainnya: "pill-neu",
};

const MODA_FILTERS = ["Semua", "Truk", "Pickup", "Kapal", "Motor", "Lainnya"] as const;

function formatPrice(v: Vendor) {
  const rp = v.price.toLocaleString("id-ID");
  return v.pricing_type === "per_km" ? `Rp ${rp}/km` : `Rp ${rp}`;
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
        (v.contact ?? "").toLowerCase().includes(q)
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
    setToast({ kind: "ok", msg: `${v.name} dihapus` });
  }

  const stats = useMemo(() => ({
    total: data.length,
    perKm: data.filter((v) => v.pricing_type === "per_km").length,
    flat: data.filter((v) => v.pricing_type === "flat_per_trip").length,
  }), [data]);

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
        <div className="flex" style={{ gap: 7 }}>
          <Stat label="Total Vendor" value={stats.total ? String(stats.total) : "—"} />
          <Stat label="Per-km" value={stats.perKm ? String(stats.perKm) : "—"} />
          <Stat label="Flat/Trip" value={stats.flat ? String(stats.flat) : "—"} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <div className="fsearch">
          <span style={{ color: "var(--ink-dim)" }}>⌕</span>
          <input
            placeholder="Cari vendor / cakupan..."
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

      {/* Table */}
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
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Vendor</th>
                <th>Moda</th>
                <th>Tipe Harga</th>
                <th>Harga</th>
                <th>Kapasitas</th>
                <th>Cakupan</th>
                <th>Kontak</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.id}>
                  <td className="mono" style={{ color: "var(--ink-dim)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={{ fontWeight: 500 }}>{v.name}</td>
                  <td>
                    <span className={`pill ${MODA_PILL[v.moda]}`} style={{ fontSize: 9 }}>
                      {MODA_LABELS[v.moda]}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {formatPricingType(v.pricing_type)}
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: "var(--ped)" }}>
                    {formatPrice(v)}
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
                        onClick={() => setEditing(v)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "3px 7px", fontSize: 10, background: "var(--dn-bg)", color: "var(--dn)", border: "1px solid #fecaca" }}
                        onClick={() => deleteVendor(v)}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sc" style={{ maxWidth: 160 }}>
      <div className="sc-l">{label}</div>
      <div className="sc-v">{value}</div>
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

    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        moda,
        pricing_type: pricingType,
        price,
        capacity_kg,
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
                  placeholder={pricingType === "per_km" ? "1200" : "2500000"}
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
                placeholder="Info tambahan..."
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
