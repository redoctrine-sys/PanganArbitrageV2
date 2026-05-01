"use client";

import { useState } from "react";

export function DropZone({ busy, onPick, onDrop }: {
  busy: boolean;
  onPick: () => void;
  onDrop: (f: File) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      className={`rounded-[10px] py-10 px-5 text-center transition-all duration-150 ${busy ? "cursor-wait" : "cursor-pointer"} ${hover ? "bg-sp-light" : "bg-paper-2"}`}
      style={{ border: `2px dashed ${hover ? "var(--sp)" : "var(--rule-mid)"}` }}
    >
      <div className="text-[28px] mb-2">📤</div>
      <div className="font-serif text-[14px] font-semibold mb-1">
        {busy ? "Memparse file..." : "Klik atau drop file di sini"}
      </div>
      <div className="font-mono text-[10px] text-ink-dim">
        .xlsx · .xls · .csv (UTF-16 LE didukung)
      </div>
    </div>
  );
}
