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

const INPUT_CLASS =
  "w-full px-[10px] py-[6px] rounded-[6px] border border-rule bg-paper text-[12px] text-ink outline-none font-sans";

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
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-[#6b7280] shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">
              Manajemen Kota
            </div>
            <div className="font-mono text-[10px] text-ink-dim">
              Edit nama display, koordinat lat/lng — referensi untuk Phase 2 cross-source &amp; arbitrase
            </div>
          </div>
        </div>
        <div className="flex gap-[7px]">
          <Stat label="Total Kota" value={stats.total ? String(stats.total) : "—"} />
          <Stat
            label="Punya Koordinat"
            value={`${stats.withCoord} / ${stats.total}`}
            accentClass={stats.withCoord < stats.total ? "text-warn" : "text-up"}
          />
        </div>
      </div>

      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
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
            <div className="empty-title">Tidak ada kota.</div>
            <div className="empty-sub">Cities di-seed otomatis saat ingest SP2KP. Upload data dulu di tab SP2KP.</div>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th className="w-14">Kode</th>
                <th>Kota</th>
                <th className="w-[140px]">Provinsi</th>
                <th className="w-20">Island</th>
                <th className="w-[90px]">Entity</th>
                <th className="w-[110px]">Lat</th>
                <th className="w-[110px]">Lng</th>
                <th className="w-[70px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const hasCoord = c.lat != null && c.lng != null;
                return (
                  <tr key={c.id}>
                    <td className={`mono text-ink-dim`}>{c.kode_wilayah ?? "—"}</td>
                    <td>
                      <div className="font-medium">{c.name}</div>
                      {c.name_sp2kp && c.name_sp2kp !== c.name && (
                        <div className="text-[10px] text-ink-dim font-mono">
                          SP2KP: {c.name_sp2kp}
                        </div>
                      )}
                    </td>
                    <td className="text-[11px]">{c.province ?? "—"}</td>
                    <td className="text-[11px]">{c.island ?? "—"}</td>
                    <td className="text-[11px]">{c.entity_type ?? "—"}</td>
                    <td className={`mono ${hasCoord ? "" : "text-ink-dim"}`}>
                      {c.lat != null ? c.lat.toFixed(6) : "—"}
                    </td>
                    <td className={`mono ${hasCoord ? "" : "text-ink-dim"}`}>
                      {c.lng != null ? c.lng.toFixed(6) : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost py-[3px] px-[9px] text-[10px]"
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

function Stat({ label, value, accentClass }: { label: string; value: string; accentClass?: string }) {
  return (
    <div className="sc max-w-[220px]">
      <div className="sc-l">{label}</div>
      <div className={`sc-v ${accentClass ?? ""}`}>{value}</div>
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
      <div className="modal max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <div className="font-serif text-[14px] font-bold">Edit Kota</div>
            <div className="font-mono text-[10px] text-ink-dim mt-[2px]">
              {city.kode_wilayah ?? "—"} · {city.province ?? "—"} · {city.island ?? "—"}
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="modal-bd flex flex-col gap-3">
            <Field label="Nama display">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Latitude">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="-6.200000"
                  value={latStr}
                  onChange={(e) => setLatStr(e.target.value)}
                  disabled={busy}
                  className={`${INPUT_CLASS} font-mono`}
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
                  className={`${INPUT_CLASS} font-mono`}
                />
              </Field>
            </div>
            <div className="text-[10px] text-ink-dim font-mono">
              Tip: koordinat dari Google Maps (klik kanan di lokasi → angka pertama = lat, kedua = lng).
              Kosongkan untuk menghapus.
            </div>
            {err && (
              <div className="anom-bar danger rounded-[6px] text-[11px]">
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
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold tracking-[.9px] uppercase text-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
