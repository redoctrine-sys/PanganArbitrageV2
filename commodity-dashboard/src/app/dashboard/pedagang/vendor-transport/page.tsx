"use client";

import { useVendorTransport } from "./hooks/useVendorTransport";
import { RouteTable } from "./components/RouteTable";
import { AddRouteForm } from "./components/AddRouteForm";

export default function VendorTransportPage() {
  const { routes, showForm, setShowForm, form, patchForm, submitRoute, deleteRoute } =
    useVendorTransport();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div
        style={{
          padding: "12px 18px 9px",
          background: "#f0ece4",
          borderBottom: "2px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-center" style={{ gap: 9, marginBottom: 4 }}>
          <div
            style={{ width: 4, height: 22, borderRadius: 3, background: "var(--ped)", flexShrink: 0 }}
          />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>
              Vendor Transport
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Data biaya angkut antar kota · Pedagang &amp; mitra logistik
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span
              className="pill"
              style={{ background: "#dbeafe", color: "var(--ped)", fontSize: 9 }}
            >
              Phase 2 — In-memory
            </span>
            {!showForm && (
              <button
                type="button"
                className="btn btn-green"
                style={{ background: "var(--ped)", fontSize: 11 }}
                onClick={() => setShowForm(true)}
              >
                + Tambah Rute
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase 2 notice */}
      <div className="anom-bar info" style={{ margin: 0, borderRadius: 0, borderBottom: "1px solid var(--rule)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>
        <span>
          Data rute tersimpan di browser sesi ini saja.{" "}
          <b>Phase 2</b>: rute akan persisted ke Supabase + dipakai Arbitrase Kalkulator secara otomatis.
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {showForm && (
          <AddRouteForm
            form={form}
            onPatch={patchForm}
            onSubmit={submitRoute}
            onCancel={() => setShowForm(false)}
          />
        )}

        <RouteTable routes={routes} onDelete={deleteRoute} />
      </div>
    </div>
  );
}
