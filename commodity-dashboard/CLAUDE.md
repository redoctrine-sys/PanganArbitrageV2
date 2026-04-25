# PanganArbitrage — Project Brain
Stack: Next.js 15 App Router · TypeScript · Supabase · Tailwind · Recharts
Deploy target: Vercel
End-state: pangan-summary-v6.md (4 tab + Admin). **Phase 1 = SP2KP only.**

## Boot sequence
1. Read `.claude/WORKBENCH.md` first — it tracks current task
2. Don't auto-read other files until needed

## PHASE 1 SCOPE: Tab SP2KP saja
Fokus: upload CSV/XLSX → parse → ingest → display accordion + chart.
Tab lain (Pedagang, Komparasi, Arbitrase, Admin) = PLACEHOLDER dulu.
Naming queue / commodity pairing / arbitrage engine = Phase 2+.

## SP2KP Parser — KRITIS (`src/lib/csv/sp2kp-parser.ts`)
- Support XLSX dan CSV (library `xlsx`).
- Kolom WAJIB di-strip: `'Komoditas '` dan `'HET/HA '` ada trailing space di file asli.
- Filter scope: prefix kode `31`–`36` (Jawa), `51` (Bali), `52` (NTB → filter Lombok only).
- Madura: kode `3526`–`3529` → `island='Madura'` (tetap dalam prefix 35/Jatim).
- Lombok include: Kab. Lombok Barat/Tengah/Timur/Utara + Kota Mataram.
- Lombok exclude: Kab/Kota Bima, Dompu, Sumbawa, Sumbawa Barat.
- Harga dtype: float64, TIDAK ada prefix 'Rp', TIDAK ada titik ribuan.
- HET/HA: ~9% null = normal, kolom nullable.
- Tanggal di file: `DD/MM/YYYY` → simpan `YYYY-MM-DD`.

## DB rules
- `prices_raw`: INSERT ONLY, `ON CONFLICT DO NOTHING`.
- UNIQUE: `(date, city_raw, commodity_raw, source)`.
- Hanya data dengan `city_id IS NOT NULL` AND `commodity_id IS NOT NULL` yang ditampilkan di UI.
- `commodity_id`: 17 komoditas SP2KP sudah seeded → exact match selalu berhasil.
- `city_id`: di-resolve dari `kode_wilayah` (paling reliable) atau `name_sp2kp`. Kalau null, kota masuk pending review (Phase 2).

## 17 Komoditas SP2KP (seed exact)
Bawang Merah, Bawang Putih Honan, Beras Medium, Beras Premium,
Cabai Merah Besar, Cabai Merah Keriting, Cabai Rawit Merah,
Daging Ayam Ras, Daging Sapi Paha Belakang, Garam Halus,
Gula Pasir Curah, Ikan Kembung, Minyak Goreng Sawit Curah,
Minyak Goreng Sawit Kemasan Premium, Minyakita, Telur Ayam Ras,
Tepung Terigu

## API routes (Phase 1)
- `POST /api/csv/preview`     ← parse file, return stats (NO insert)
- `POST /api/ingest/sp2kp`    ← insert rows ke `prices_raw`
- `GET  /api/prices`          ← query approved data untuk chart (`?city_id=&commodity_id=&days=30`)
- `GET  /api/sp2kp/latest`    ← RPC `get_sp2kp_latest`, optional `?island=&province=`

## Display logic
- Level 1 (kota) dan Level 2 (komoditas): dari RPC `get_sp2kp_latest()`, group client-side.
- Chart data: GET `/api/prices` lazy on commodity expand.
- Semua metric (changePct, volatility, vsAvg, trend) dihitung client-side via `lib/analytics/metrics.ts`.
- HET/HA muncul HANYA sebagai ReferenceLine di chart + 1 baris di stats panel. TIDAK di row list.
- Accordion: 1 kota terbuka pada satu waktu, 1 komoditas per kota.

## Design tokens (v8 mockup, Tailwind theme)
`--sp:#1b5e3b` `--up:#166534` `--dn:#991b1b` `--warn:#78350f` `--hi:#9a3412` `--lo:#14532d`
Paper background `#f5f1ea`, ink `#1a1612`. Serif = Fraunces, mono = DM Mono, sans = DM Sans.

## Performa
- RPC `get_sp2kp_latest()` dipanggil sekali saat page load (filter island di server).
- Filter provinsi/kota client-side dari hasil fetch.
- Chart lazy on demand, max 90 hari per series.
