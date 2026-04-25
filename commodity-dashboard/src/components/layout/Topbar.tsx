"use client";

import { useEffect, useState } from "react";

interface TopbarProps {
  onUploadClick: () => void;
}

export function Topbar({ onUploadClick }: TopbarProps) {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(now);
      setTime(`${fmt} WIB`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="flex items-center px-4 flex-shrink-0 relative"
      style={{ background: "var(--ink)", height: 50, zIndex: 500 }}
    >
      <div
        className="font-serif font-bold mr-5 whitespace-nowrap"
        style={{ color: "#f5f1ea", fontSize: 16 }}
      >
        Pangan<span className="italic" style={{ color: "#6ee7a0" }}>Arbitrage</span>
      </div>
      <div className="flex flex-1 gap-px overflow-hidden">
        <TabNav active label="SP2KP" pip="#6ee7a0" badge="Harian" />
        <TabNav label="Pedagang" pip="#93c5fd" placeholder />
        <TabNav label="Komparasi" pip="#c4b5fd" placeholder />
        <TabNav label="Arbitrase" pip="#fb923c" placeholder />
        <TabNav label="Admin" pip="#6b7280" placeholder />
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
        <div
          className="font-mono"
          style={{ fontSize: 10, color: "rgba(245,241,234,.5)" }}
        >
          {time}
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className="btn"
          style={{
            background: "var(--sp)",
            color: "var(--sp-light)",
            padding: "6px 12px",
            fontSize: 11,
          }}
        >
          ↑ Upload SP2KP
        </button>
      </div>
    </div>
  );
}

function TabNav({
  label,
  pip,
  badge,
  active,
  placeholder,
}: {
  label: string;
  pip: string;
  badge?: string;
  active?: boolean;
  placeholder?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-md whitespace-nowrap flex-shrink-0"
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        color: active ? "#f5f1ea" : "rgba(245,241,234,.38)",
        background: active ? "rgba(245,241,234,.12)" : "transparent",
        opacity: placeholder ? 0.5 : 1,
        cursor: placeholder ? "not-allowed" : "pointer",
      }}
      title={placeholder ? "Tab ini akan tersedia di Phase 2+" : undefined}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: pip,
          flexShrink: 0,
        }}
      />
      {label}
      {badge && (
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 10,
            background: "rgba(245,241,234,.1)",
            color: "rgba(245,241,234,.55)",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
