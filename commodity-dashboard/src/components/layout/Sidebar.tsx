"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{
        width: 186,
        background: "#f0ece4",
        borderRight: "1px solid var(--rule)",
        padding: "10px 7px",
      }}
    >
      <SectionLabel>Sumber Data</SectionLabel>
      <Item
        href="/dashboard/sp2kp"
        active={pathname === "/dashboard/sp2kp"}
        label="SP2KP"
        pip="var(--sp)"
        badge="Live"
        badgeStyle={{ background: "var(--sp-light)", color: "var(--sp)" }}
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

      <div
        className="mt-auto p-2.5 font-mono"
        style={{
          marginTop: "auto",
          background: "var(--paper)",
          borderRadius: 7,
          border: "1px solid var(--rule)",
          fontSize: 10,
          color: "var(--ink-dim)",
          lineHeight: 1.8,
        }}
      >
        <b style={{ color: "var(--ink-mid)" }}>SP2KP</b> aktif
        <br />
        <b style={{ color: "var(--ink-mid)" }}>Transport</b> aktif
        <br />
        Komparasi Â· Arbitrase Â· Pedagang data â†’ Phase 2+.
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "1.6px",
        textTransform: "uppercase", color: "var(--ink-dim)", padding: "7px 8px 4px",
      }}
    >
      {children}
    </div>
  );
}

function Item({
  label, pip, badge, badgeStyle, active, placeholder, dim, href,
}: {
  label: string; pip: string; badge?: string;
  badgeStyle?: React.CSSProperties; active?: boolean;
  placeholder?: boolean; dim?: boolean; href?: string;
}) {
  const inner = (
    <>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: pip, flexShrink: 0 }} />
      {label}
      {badge && (
        <span
          className="ml-auto font-mono"
          style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 5,
            ...badgeStyle,
          }}
        >
          {badge}
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    padding: "6px 9px",
    borderRadius: 6,
    fontSize: 12,
    color: active ? "var(--paper)" : "var(--ink-mid)",
    background: active ? "var(--ink)" : "transparent",
    fontWeight: active ? 500 : 400,
    opacity: dim ? 0.7 : 1,
    cursor: placeholder ? "not-allowed" : "pointer",
    textDecoration: "none",
  };

  if (href && !placeholder) {
    return (
      <Link href={href} className="flex items-center gap-2 mb-px select-none" style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div
      className="flex items-center gap-2 mb-px select-none"
      style={style}
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
  const style: React.CSSProperties = {
    padding: "5px 9px 5px 26px",
    borderRadius: 5,
    fontSize: 11,
    color: active ? "var(--ink)" : "var(--ink-dim)",
    background: active ? "var(--paper)" : "transparent",
    fontWeight: active ? 600 : 400,
    cursor: placeholder ? "not-allowed" : "pointer",
    marginBottom: 1,
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  if (href && !placeholder) {
    return (
      <Link href={href} className="select-none" style={style}>
        {label}
      </Link>
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 select-none"
      style={style}
    >
      {label}
    </div>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--rule)",
        margin: "6px 0",
      }}
    />
  );
}
