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
    <div className="flex items-center px-4 shrink-0 relative bg-ink h-[50px] z-[500]">
      <div className="font-serif font-bold mr-5 whitespace-nowrap text-[16px] text-[#f5f1ea]">
        Pangan<span className="italic text-[#6ee7a0]">Arbitrage</span>
      </div>
      <div className="flex flex-1 gap-px overflow-hidden">
        <TabNav active label="SP2KP" pip="#6ee7a0" badge="Harian" />
        <TabNav label="Pedagang" pip="#93c5fd" placeholder />
        <TabNav label="Komparasi" pip="#c4b5fd" placeholder />
        <TabNav label="Arbitrase" pip="#fb923c" placeholder />
        <TabNav label="Admin" pip="#6b7280" placeholder />
      </div>
      <div className="flex items-center gap-2.5 shrink-0 ml-auto">
        <div className="font-mono text-[10px] text-[rgba(245,241,234,.5)]">
          {time}
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className="btn bg-sp text-sp-light px-3 py-[6px] text-[11px]"
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
      className={`flex items-center gap-1.5 px-3 py-1 rounded-md whitespace-nowrap shrink-0 text-[11.5px] font-medium ${
        active
          ? "text-[#f5f1ea] bg-[rgba(245,241,234,.12)]"
          : "text-[rgba(245,241,234,.38)]"
      } ${placeholder ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      title={placeholder ? "Tab ini akan tersedia di Phase 2+" : undefined}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: pip }}
      />
      {label}
      {badge && (
        <span className="font-mono text-[9px] px-[5px] py-px rounded-[10px] bg-[rgba(245,241,234,.1)] text-[rgba(245,241,234,.55)]">
          {badge}
        </span>
      )}
    </div>
  );
}
