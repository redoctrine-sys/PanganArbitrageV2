"use client";

import { useCallback, useRef, useState } from "react";

const TOGGLE_COOLDOWN_MS = 250;

/**
 * Selector hook for accordion-style toggle: only one ID open at a time.
 * Protects against rapid double-clicks (state thrash) via a cooldown lock —
 * if a toggle fires within TOGGLE_COOLDOWN_MS of the previous one, it is ignored.
 *
 * Returns:
 *   openId — currently open ID (null = nothing open)
 *   toggle(id) — open if closed, close if same ID. Pass `e?` to call stopPropagation.
 */
export function useToggleSelector() {
  const [openId, setOpenId] = useState<string | null>(null);
  const lastClickRef = useRef(0);

  const toggle = useCallback((id: string, e?: { stopPropagation?: () => void }) => {
    if (e?.stopPropagation) e.stopPropagation();
    const now = Date.now();
    if (now - lastClickRef.current < TOGGLE_COOLDOWN_MS) return;
    lastClickRef.current = now;
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  return { openId, toggle };
}
