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
    <div style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden" }}>
      <table className="preview-table" style={{ margin: 0 }}>
        <thead>
          <tr>
            <th>Dari</th>
            <th>Ke</th>
            <th>Kendaraan</th>
            <th style={{ textAlign: "right" }}>Biaya/kg</th>
            <th style={{ textAlign: "right" }}>Jarak (km)</th>
            <th>Catatan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.fromCity}</td>
              <td style={{ fontWeight: 500 }}>{r.toCity}</td>
              <td>
                <span className="pill pill-neu">{VEHICLE_LABELS[r.vehicleType]}</span>
              </td>
              <td className="mono" style={{ textAlign: "right", color: "var(--ink)" }}>
                {formatRupiah(r.costPerKg)}
              </td>
              <td className="mono" style={{ textAlign: "right", color: "var(--ink-dim)" }}>
                {r.distanceKm ?? "—"}
              </td>
              <td style={{ color: "var(--ink-dim)", fontSize: 11 }}>{r.notes || "—"}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "3px 8px" }}
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
