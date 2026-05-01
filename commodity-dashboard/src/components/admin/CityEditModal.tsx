"use client";

import { useState } from "react";

interface City {
  id: string;
  kode_wilayah: string | null;
  name: string;
  province: string | null;
  island: string | null;
  lat: number | null;
  lng: number | null;
}

const INPUT_CLASS =
  "w-full px-[10px] py-[6px] rounded-[6px] border border-rule bg-paper text-[12px] text-ink outline-none font-sans";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold tracking-[.9px] uppercase text-ink-dim">{label}</span>
      {children}
    </label>
  );
}

interface Props {
  city: City;
  onClose: () => void;
  onSave: (patch: Partial<City>) => Promise<void>;
}

export function CityEditModal({ city, onClose, onSave }: Props) {
  const [name, setName] = useState(city.name);
  const [latStr, setLatStr] = useState(city.lat != null ? String(city.lat) : "");
  const [lngStr, setLngStr] = useState(city.lng != null ? String(city.lng) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setErr("Nama wajib diisi"); return; }
    const lat = latStr.trim() === "" ? null : Number(latStr);
    const lng = lngStr.trim() === "" ? null : Number(lngStr);
    if (latStr.trim() && (!Number.isFinite(lat) || (lat as number) < -90 || (lat as number) > 90)) {
      setErr("Lat harus angka antara -90 dan 90"); return;
    }
    if (lngStr.trim() && (!Number.isFinite(lng) || (lng as number) < -180 || (lng as number) > 180)) {
      setErr("Lng harus angka antara -180 dan 180"); return;
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
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                disabled={busy} className={INPUT_CLASS} />
            </Field>
            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Latitude">
                <input type="text" inputMode="decimal" placeholder="-6.200000"
                  value={latStr} onChange={(e) => setLatStr(e.target.value)}
                  disabled={busy} className={`${INPUT_CLASS} font-mono`} />
              </Field>
              <Field label="Longitude">
                <input type="text" inputMode="decimal" placeholder="106.816666"
                  value={lngStr} onChange={(e) => setLngStr(e.target.value)}
                  disabled={busy} className={`${INPUT_CLASS} font-mono`} />
              </Field>
            </div>
            <div className="text-[10px] text-ink-dim font-mono">
              Tip: koordinat dari Google Maps (klik kanan → angka pertama = lat, kedua = lng). Kosongkan untuk menghapus.
            </div>
            {err && <div className="anom-bar danger rounded-[6px] text-[11px]">⚠ <span>{err}</span></div>}
          </div>
          <div className="modal-ft">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
            <button type="submit" className="btn btn-green" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
