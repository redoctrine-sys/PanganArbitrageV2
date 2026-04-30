"use client";

import { useEffect, useMemo, useState } from "react";

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

export function AdminCitiesPage() {
  const [data, setData] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [island, setIsland] = useState<(typeof ISLANDS)[number]>("Semua");
  const [editing, setEditing] = useState<City | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cities?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) setError(json.error);
      setData((json.data ?? []) as City[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  // Auto-dismiss toast after 2.5s.
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
      return (
        c.name.toLowerCase().includes(q) ||
        (c.kode_wilayah ?? "").toLowerCase().includes(q) ||
        (c.province ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, island]);

  const stats = useMemo(() => {
    const total = data.length;
    const withCoord = data.filter((c) => c.lat != null && c.lng != null).length;
    return { total, withCoord };
  }, [data]);

  async function saveCity(patch: Partial<City>) {
    if (!editing) return;
    let res: Response;
    try {
      res = await fetch(`/api/cities/${editing.id}`, {
        method: "PATCH",
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
    setData((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...json.data } : c)));
    setEditing(null);
    setToast({ kind: "ok", msg: `${json.data.name} tersimpan · lat ${json.data.lat ?? "—"} lng ${json.data.lng ?? "—"}` });
    reload();
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        style={{
          padding: "12px 18px 9px",
          background: "#f0ece4",
          borderBottom: "2px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
          <div style={{ width: 4, height: 22, borderRadius: 3, background: "#6b7280", flexShrink: 0 }} />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>
              Manajemen Kota
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Edit nama display, koordinat lat/lng — referensi untuk Phase 2 cross-source &amp; arbitrase
            </div>
          </div>
        </div>
        <div className="flex" style={{ gap: 7 }}>
          <Stat label="Total Kota" value={stats.total ? String(stats.total) : "—"} />
          <Stat
            label="Punya Koordinat"
            value={`${stats.withCoord} / ${stats.total}`}
            accent={stats.withCoord < stats.total ? "var(--warn)" : "var(--up)"}
          />
        </div>
      </div>

      <div className="fbar">
        <div className="fsearch">
          <span style={{ color: "var(--ink-dim)" }}>⌕</span>
          <input
            placeholder="Cari kota / kode / provinsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {ISLANDS.map((i) => (
          <button
            key={i}
            type="button"
            className={`fbtn ${island === i ? "on" : ""}`}
            onClick={() => setIsland(i)}
          >
            {i}
          </button>
        ))}
        <div className="fhint">{filtered.length} kota</div>
      </div>

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
            <div className="empty-title">Tidak ada kota.</div>
            <div className="empty-sub">Cities di-seed otomatis saat ingest SP2KP. Upload data dulu di tab SP2KP.</div>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Kode</th>
                <th>Kota</th>
                <th style={{ width: 140 }}>Provinsi</th>
                <th style={{ width: 80 }}>Island</th>
                <th style={{ width: 90 }}>Entity</th>
                <th style={{ width: 110 }}>Lat</th>
                <th style={{ width: 110 }}>Lng</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const hasCoord = c.lat != null && c.lng != null;
                return (
                  <tr key={c.id}>
                    <td className="mono" style={{ color: "var(--ink-dim)" }}>{c.kode_wilayah ?? "—"}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.name_sp2kp && c.name_sp2kp !== c.name && (
                        <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                          SP2KP: {c.name_sp2kp}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>{c.province ?? "—"}</td>
                    <td style={{ fontSize: 11 }}>{c.island ?? "—"}</td>
                    <td style={{ fontSize: 11 }}>{c.entity_type ?? "—"}</td>
                    <td className="mono" style={{ color: hasCoord ? undefined : "var(--ink-dim)" }}>
                      {c.lat != null ? c.lat.toFixed(6) : "—"}
                    </td>
                    <td className="mono" style={{ color: hasCoord ? undefined : "var(--ink-dim)" }}>
                      {c.lng != null ? c.lng.toFixed(6) : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "3px 9px", fontSize: 10 }}
                        onClick={() => setEditing(c)}
                      >
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

      {editing && (
        <EditModal
          city={editing}
          onClose={() => setEditing(null)}
          onSave={saveCity}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="sc" style={{ maxWidth: 220 }}>
      <div className="sc-l">{label}</div>
      <div className="sc-v" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function EditModal({
  city,
  onClose,
  onSave,
}: {
  city: City;
  onClose: () => void;
  onSave: (patch: Partial<City>) => Promise<void>;
}) {
  const [name, setName] = useState(city.name);
  const [latStr, setLatStr] = useState(city.lat != null ? String(city.lat) : "");
  const [lngStr, setLngStr] = useState(city.lng != null ? String(city.lng) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setErr("Nama wajib diisi");
      return;
    }

    const lat = latStr.trim() === "" ? null : Number(latStr);
    const lng = lngStr.trim() === "" ? null : Number(lngStr);
    if (latStr.trim() !== "" && (!Number.isFinite(lat) || (lat as number) < -90 || (lat as number) > 90)) {
      setErr("Lat harus angka antara -90 dan 90");
      return;
    }
    if (lngStr.trim() !== "" && (!Number.isFinite(lng) || (lng as number) < -180 || (lng as number) > 180)) {
      setErr("Lng harus angka antara -180 dan 180");
      return;
    }

    setBusy(true);
    try {
      await onSave({ name: trimmedName, lat, lng });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-hd">
          <div>
            <div className="font-serif" style={{ fontSize: 14, fontWeight: 700 }}>Edit Kota</div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)", marginTop: 2 }}>
              {city.kode_wilayah ?? "—"} · {city.province ?? "—"} · {city.island ?? "—"}
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="modal-bd" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Nama display">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                style={inputStyle}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Latitude">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="-6.200000"
                  value={latStr}
                  onChange={(e) => setLatStr(e.target.value)}
                  disabled={busy}
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="106.816666"
                  value={lngStr}
                  onChange={(e) => setLngStr(e.target.value)}
                  disabled={busy}
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                />
              </Field>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
              Tip: koordinat dari Google Maps (klik kanan di lokasi → angka pertama = lat, kedua = lng).
              Kosongkan untuk menghapus.
            </div>
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
              {busy ? "Menyimpan..." : "Simpan"}
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
      <span
        className="font-mono"
        style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".9px", textTransform: "uppercase", color: "var(--ink-dim)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
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
