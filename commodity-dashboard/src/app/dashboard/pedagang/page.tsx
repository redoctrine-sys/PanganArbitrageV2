"use client";

import { useState } from "react";
import { VendorTransportPage } from "@/components/pedagang/VendorTransportPage";

type Sub = "data" | "transport";

export default function PedaganPage() {
  const [sub, setSub] = useState<Sub>("transport");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab header */}
      <div style={{ padding: "12px 18px 0", background: "#f0ece4", borderBottom: "2px solid var(--rule)", flexShrink: 0 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
          <div style={{ width: 4, height: 22, borderRadius: 3, background: "var(--ped)", flexShrink: 0 }} />
          <div>
            <div className="font-serif" style={{ fontSize: 15, fontWeight: 700 }}>
              Database Pedagang &amp; Transport
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-dim)" }}>
              Input manual · Komoditas baru → masuk Commodity Agent queue
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, paddingBottom: 0 }}>
          <button
            type="button"
            className={`stab ${sub === "data" ? "active" : ""}`}
            style={{ cursor: "not-allowed", opacity: 0.5 }}
            title="Phase 2+"
          >
            👥 Data Pedagang{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dim)", marginLeft: 3 }}>
              Phase 2+
            </span>
          </button>
          <button
            type="button"
            className={`stab ${sub === "transport" ? "active" : ""}`}
            onClick={() => setSub("transport")}
          >
            🚛 Vendor Transport{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dim)", marginLeft: 3 }}>
              18
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      {sub === "transport" && <VendorTransportPage />}
      {sub === "data" && (
        <div className="empty">
          <div className="empty-title">Data Pedagang</div>
          <div className="empty-sub">Tersedia di Phase 2+</div>
        </div>
      )}
    </div>
  );
}
