"use client";

import { formatRupiah } from "@/lib/analytics/metrics";
import type { TransportRoute } from "../types/vendor";
import { VEHICLE_LABELS } from "../types/vendor";

interface Props {
  routes: TransportRoute[];
  onDelete: (id: string) => void;
}

export function RouteTable({ routes, onDelete }: Props) {
  if (routes.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Belum ada rute transport</div>
        <div className="empty-sub">Tambahkan rute untuk menyimpan data biaya angkut antar kota.</div>
      </div>
    );
  }

  return (
    <div className="border border-rule rounded-[10px] overflow-hidden">
      <table className="preview-table m-0">
        <thead>
          <tr>
            <th>Dari</th>
            <th>Ke</th>
            <th>Kendaraan</th>
            <th className="text-right">Biaya/kg</th>
            <th className="text-right">Jarak (km)</th>
            <th>Catatan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.fromCity}</td>
              <td className="font-medium">{r.toCity}</td>
              <td>
                <span className="pill pill-neu">{VEHICLE_LABELS[r.vehicleType]}</span>
              </td>
              <td className="mono text-right text-ink">
                {formatRupiah(r.costPerKg)}
              </td>
              <td className="mono text-right text-ink-dim">
                {r.distanceKm ?? "—"}
              </td>
              <td className="text-ink-dim text-[11px]">{r.notes || "—"}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost text-[11px] py-[3px] px-2"
                  onClick={() => onDelete(r.id)}
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
