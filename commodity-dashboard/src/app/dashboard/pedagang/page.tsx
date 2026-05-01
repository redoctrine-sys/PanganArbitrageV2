"use client";

// Harga Pedagang — data harga pasar dari pedagang lapangan.
// Phase 3: input manual + scraper otomatis.
// Kolom mengacu pada desain panganv8.html.

const DEMO_COLS = ["#", "Nama Pedagang", "Kota", "Lokasi (Pasar)", "Komoditas", "Harga Terakhir", "Status", ""];

const DEMO_ROWS = [
  { nama: "Pak Budi", kota: "Yogyakarta", lokasi: "Pasar Beringharjo", komoditas: "Cabai Rawit Merah", harga: "Rp 82.000/kg", status: "mapped" },
  { nama: "Bu Sari", kota: "Denpasar", lokasi: "Pasar Badung", komoditas: "Bawang Merah", harga: "Rp 42.000/kg", status: "mapped" },
  { nama: "Pak Hendra", kota: "Surabaya", lokasi: "Pasar Keputran", komoditas: "Cabe Merah Keriting", harga: "—", status: "pending" },
];

const statusBadge: Record<string, { label: string; cls: string }> = {
  mapped:  { label: "✓ SP2KP Mapped", cls: "pill-ok" },
  pending: { label: "⏳ Pending Review", cls: "pill-mid" },
};

export default function HargaPedagangPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pt-3 pb-[9px] bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px] mb-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-ped shrink-0" />
          <div className="flex-1">
            <div className="font-serif text-[15px] font-bold">Harga Pedagang</div>
            <div className="font-mono text-[10px] text-ink-dim">
              Data harga lapangan dari pedagang pasar · Input manual + scraper otomatis (Phase 3)
            </div>
          </div>
          <span className="pill bg-paper-3 text-ink-dim text-[9px]">Phase 3</span>
        </div>
        <div className="flex gap-[7px]">
          <div className="sc"><div className="sc-l">Pedagang terdaftar</div><div className="sc-v">—</div></div>
          <div className="sc"><div className="sc-l">Komoditas dipantau</div><div className="sc-v">—</div></div>
          <div className="sc"><div className="sc-l">Update terakhir</div><div className="sc-v">—</div></div>
        </div>
      </div>

      {/* Phase 3 notice */}
      <div className="anom-bar info m-0 rounded-none border-t-0 border-l-0 border-r-0 border-b border-rule">
        <span>
          🔲 <b>Phase 3</b>: Data harga pedagang akan dikumpulkan via input manual + scraper otomatis.
          Akan di-compare dengan SP2KP untuk deteksi anomali cross-source.
        </span>
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <div className="fsearch">
          <span className="text-ink-dim">⌕</span>
          <input placeholder="Cari pedagang / kota / komoditas..." disabled className="cursor-not-allowed" />
        </div>
        <div className="fhint">Demo data — Phase 3 belum aktif</div>
        <button type="button" className="btn btn-green ml-auto opacity-50 cursor-not-allowed" disabled>
          + Tambah Pedagang
        </button>
      </div>

      {/* Table — demo rows untuk gambaran kolom */}
      <div className="flex-1 overflow-y-auto">
        <table className="preview-table" style={{ tableLayout: "fixed", width: "100%" }}>
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Nama Pedagang</th>
              <th className="w-[120px]">Kota</th>
              <th className="w-[160px]">Lokasi (Pasar)</th>
              <th className="w-[180px]">Komoditas</th>
              <th className="w-[120px]">Harga Terakhir</th>
              <th className="w-[140px]">Status Komoditas</th>
              <th className="w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ROWS.map((r, i) => (
              <tr key={i} className="opacity-50">
                <td className="mono text-ink-dim">{String(i + 1).padStart(2, "0")}</td>
                <td className="font-medium">{r.nama}</td>
                <td className="text-[11px]">{r.kota}</td>
                <td className="text-[11px] text-ink-dim">{r.lokasi}</td>
                <td className="text-[11px]">{r.komoditas}</td>
                <td className="mono text-sp">{r.harga}</td>
                <td>
                  <span className={`pill text-[9px] ${statusBadge[r.status].cls}`}>
                    {statusBadge[r.status].label}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn btn-ghost py-[3px] px-[9px] text-[10px] opacity-50 cursor-not-allowed" disabled>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="empty">
          <div className="text-[28px] mb-2">📋</div>
          <div className="empty-title">Data Pedagang — Phase 3</div>
          <div className="empty-sub">
            Setelah Phase 3 aktif, tabel ini akan berisi harga real dari pedagang pasar.<br />
            Akan ter-<b>compare</b> dengan SP2KP untuk deteksi anomali cross-source.
          </div>
        </div>
      </div>
    </div>
  );
}
