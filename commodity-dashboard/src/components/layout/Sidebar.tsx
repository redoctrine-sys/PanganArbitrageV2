"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertBadge } from "@/components/arbitrase/AlertBadge";

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
        active={pathname.startsWith("/dashboard/pedagang")}
        label="Pedagang"
        pip="var(--ped)"
      />
      <Sub label="Data Harga" placeholder />
      <Sub
        href="/dashboard/pedagang/vendor-transport"
        active={pathname.startsWith("/dashboard/pedagang/vendor-transport")}
        label="Vendor Transport"
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
      <Sub label="AI Suggestion" placeholder />
      <Sub
        href="/dashboard/arbitrase"
        active={pathname === "/dashboard/arbitrase"}
        label="Manual Kalkulator"
      />

      <Divider />
      <SectionLabel>Admin</SectionLabel>
      <Item label="Admin Hidden" pip="#6b7280" dim />
      <Sub label="Naming Queue" placeholder />
      <Sub label="Commodity Queue" placeholder />
      <Sub
        href="/dashboard/admin/cities"
        active={pathname === "/dashboard/admin/cities"}
        label="Kota"
      />
      <Sub label="Ingest Log" placeholder />

      <div className="mt-auto p-2.5 font-mono bg-paper rounded-[7px] border border-rule text-[10px] text-ink-dim leading-[1.8]">
        <b className="text-ink-mid">SP2KP</b> aktif
        <br />
        <b className="text-ink-mid">Transport</b> aktif
        <br />
        Komparasi · Arbitrase · Pedagang data → Phase 2+.
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
  const baseClass = `select-none flex items-center gap-[6px] pl-[26px] pr-[9px] py-[5px] rounded-[5px] text-[11px] mb-px no-underline
    ${active ? "text-ink bg-paper font-semibold" : "text-ink-dim bg-transparent font-normal"}
    ${placeholder ? "cursor-not-allowed" : "cursor-pointer"}`;

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
