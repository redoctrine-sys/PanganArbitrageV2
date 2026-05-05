"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertBadge } from "@/components/arbitrase/AlertBadge";

// Isolated so useSearchParams only suspends this small slice, not the whole sidebar.
function ArbitraseSubnav({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const activeTab = pathname.startsWith("/dashboard/arbitrase")
    ? (searchParams.get("tab") ?? "manual")
    : null;
  return (
    <>
      <Sub href="/dashboard/arbitrase?tab=ai" active={activeTab === "ai"} label="🤖 AI Suggestion" />
      <Sub href="/dashboard/arbitrase" active={activeTab === "manual"} label="⚡ Manual Kalkulator" />
    </>
  );
}

// Fallback shown during Suspense — sub-items without active highlight.
function ArbitraseSubnavFallback() {
  return (
    <>
      <Sub href="/dashboard/arbitrase?tab=ai" label="🤖 AI Suggestion" />
      <Sub href="/dashboard/arbitrase" label="⚡ Manual Kalkulator" />
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto w-[186px] bg-[#f0ece4] border-r border-rule p-[10px_7px]"
    >
      <SectionLabel>Sumber Data</SectionLabel>
      <Item
        href="/dashboard/sp2kp"
        active={pathname === "/dashboard/sp2kp"}
        label="SP2KP"
        pip="var(--sp)"
        badge="Live"
        badgeClassName="bg-sp-light text-sp"
      />
      <Item
        href="/dashboard/pedagang"
        active={pathname === "/dashboard/pedagang"}
        label="Harga Pedagang"
        pip="var(--ped)"
        badge="Beta"
        badgeClassName="bg-[#dcfce7] text-[#1b5e3b]"
      />
      <Item
        href="/dashboard/pihps"
        active={pathname === "/dashboard/pihps"}
        label="PIHPS"
        pip="#0369a1"
        badge="Beta"
        badgeClassName="bg-[#dbeafe] text-[#1e40af]"
      />
      <Item
        href="/dashboard/pedagang/vendor-transport"
        active={pathname.startsWith("/dashboard/pedagang/vendor-transport")}
        label="Vendor Transport"
        pip="#6366f1"
        badge="Live"
        badgeClassName="bg-[#ede9fe] text-[#4f46e5]"
      />
      <Item
        label="Data Lain"
        pip="#94a3b8"
        placeholder
        badge="Phase 3"
        badgeClassName="bg-paper-3 text-ink-dim"
      />

      <Divider />
      <SectionLabel>Analitik</SectionLabel>
      <Item label="Komparasi" pip="var(--comp)" placeholder />
      <Item
        href="/dashboard/arbitrase"
        active={pathname.startsWith("/dashboard/arbitrase")}
        label="Arbitrase"
        pip="var(--arb)"
        badge={<AlertBadge />}
      />
      <Suspense fallback={<ArbitraseSubnavFallback />}>
        <ArbitraseSubnav pathname={pathname} />
      </Suspense>
      <Item
        href="/dashboard/route-maker"
        active={pathname.startsWith("/dashboard/route-maker")}
        label="🗺 Route Maker"
        pip="#0ea5e9"
        badge="Beta"
        badgeClassName="bg-[#e0f2fe] text-[#0369a1]"
      />

      <Divider />
      <SectionLabel>Admin</SectionLabel>
      <Item label="Admin" pip="#6b7280" dim />
      <Sub label="Naming Queue" placeholder />
      <Sub label="Commodity Queue" placeholder />
      <Sub
        href="/dashboard/admin/cities"
        active={pathname === "/dashboard/admin/cities"}
        label="Kota"
      />
      <Sub label="Ingest Log" placeholder />

      <div className="mt-auto p-2.5 font-mono bg-paper rounded-[7px] border border-rule text-[10px] text-ink-dim leading-[1.8]">
        <b className="text-ink-mid">SP2KP</b> aktif<br />
        <b className="text-ink-mid">Transport</b> aktif<br />
        <b className="text-ink-mid">PIHPS</b> beta · scraper<br />
        <b className="text-ink-mid">Pedagang</b> beta · extension
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold tracking-[1.6px] uppercase text-ink-dim px-2 pt-[7px] pb-1">
      {children}
    </div>
  );
}

function Item({
  label, pip, badge, badgeClassName, active, placeholder, dim, href,
}: {
  label: string; pip: string; badge?: React.ReactNode;
  badgeClassName?: string; active?: boolean;
  placeholder?: boolean; dim?: boolean; href?: string;
}) {
  const baseClass = `flex items-center gap-2 mb-px select-none px-[9px] py-[6px] rounded-[6px] text-[12px] no-underline transition-colors duration-100
    ${active ? "text-paper bg-ink font-medium" : "text-ink-mid bg-transparent font-normal"}
    ${dim ? "opacity-70" : ""}
    ${placeholder ? "cursor-not-allowed" : "cursor-pointer"}`;

  const inner = (
    <>
      {/* pip dot — color is dynamic from prop, must stay as inline style */}
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: pip, flexShrink: 0 }} />
      {label}
      {badge && (
        typeof badge === "string"
          ? <span className={`ml-auto font-mono text-[9px] px-[5px] py-px rounded-[5px] ${badgeClassName ?? ""}`}>{badge}</span>
          : badge
      )}
    </>
  );

  if (href && !placeholder) {
    return <Link href={href} className={baseClass}>{inner}</Link>;
  }
  return (
    <div
      className={baseClass}
      title={placeholder ? "Tab ini akan tersedia di Phase 2+" : undefined}
    >
      {inner}
    </div>
  );
}

function Sub({
  label, placeholder, href, active,
}: {
  label: string; placeholder?: boolean; href?: string; active?: boolean;
}) {
  const baseClass = `select-none flex items-center gap-[6px] pl-[26px] pr-[9px] py-[5px] rounded-[5px] text-[11px] mb-px no-underline transition-colors duration-100
    ${active ? "text-ink bg-paper font-semibold" : "text-ink-dim bg-transparent font-normal hover:text-ink hover:bg-paper"}
    ${placeholder ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`;

  if (href && !placeholder) {
    return <Link href={href} className={baseClass}>{label}</Link>;
  }
  return (
    <div className={baseClass} title={placeholder ? "Tab ini akan tersedia di Phase 2+" : undefined}>
      {label}
    </div>
  );
}

function Divider() {
  return <hr className="border-none border-t border-rule my-[6px]" />;
}
