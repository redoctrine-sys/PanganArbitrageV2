"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function AlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = getClient();
    async function load() {
      const { count: c } = await supabase
        .from("arbitrage_alerts")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      setCount(c ?? 0);
    }
    load();
    // Refresh every 60s
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-dn text-white text-[9px] font-bold font-mono px-[5px]">
      {count > 99 ? "99+" : count}
    </span>
  );
}
