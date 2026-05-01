"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArbitrasePage } from "@/components/arbitrase/ArbitrasePage";

function ArbitraseContent() {
  const params = useSearchParams();
  const defaultTab = params.get("tab") === "ai" ? "ai" : "manual";
  return <ArbitrasePage defaultTab={defaultTab} />;
}

export default function ArbitraseRoute() {
  return (
    <Suspense fallback={<ArbitrasePage defaultTab="manual" />}>
      <ArbitraseContent />
    </Suspense>
  );
}
