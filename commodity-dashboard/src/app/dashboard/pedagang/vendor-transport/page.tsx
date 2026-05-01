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
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-1">
          <div className="w-1 h-[22px] rounded-[3px] bg-ped shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">
              Vendor Transport
            </div>
            <div className="font-mono text-[10px] text-ink-dim">
              Data biaya angkut antar kota · Pedagang &amp; mitra logistik
            </div>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            <span className="pill bg-ped-light text-ped text-[9px]">
              Phase 2 — In-memory
            </span>
            {!showForm && (
              <button
                type="button"
                className="btn btn-green bg-ped text-[11px]"
                onClick={() => setShowForm(true)}
              >
                + Tambah Rute
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase 2 notice */}
      <div className="anom-bar info m-0 rounded-none border-t-0 border-l-0 border-r-0 border-b border-rule">
        <span>
          Data rute tersimpan di browser sesi ini saja.{" "}
          <b>Phase 2</b>: rute akan persisted ke Supabase + dipakai Arbitrase Kalkulator secara otomatis.
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-[14px]">
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
