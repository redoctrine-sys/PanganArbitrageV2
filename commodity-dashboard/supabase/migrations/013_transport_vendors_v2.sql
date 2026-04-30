-- ═══════════════════════════════════════
-- 013 — Transport Vendors v2
-- + moda 'mobil' (MPV/Van)
-- + base_fare_rp, base_km columns (Lalamove tiered pricing)
-- + seed: Lalamove 5 armada, ASDP Jawa-Bali 5 gol, ASDP Jawa-Lombok 5 gol
-- ═══════════════════════════════════════

-- Expand moda constraint
ALTER TABLE transport_vendors DROP CONSTRAINT IF EXISTS transport_vendors_moda_check;
ALTER TABLE transport_vendors ADD CONSTRAINT transport_vendors_moda_check
  CHECK (moda IN ('truk','pickup','kapal','motor','mobil','lainnya'));

-- Tiered-pricing support (base fare + included km)
ALTER TABLE transport_vendors ADD COLUMN IF NOT EXISTS base_fare_rp numeric(12,0);
ALTER TABLE transport_vendors ADD COLUMN IF NOT EXISTS base_km     numeric(6,1);

-- ── Lalamove ────────────────────────────────────────────────────────────────
INSERT INTO transport_vendors
  (name, moda, pricing_type, price, capacity_kg, coverage, contact, notes, base_fare_rp, base_km)
VALUES
  (
    'Lalamove - Motor',
    'motor', 'per_km', 2000, 20,
    NULL, 'Lalamove',
    'Tarif setelah 3 km pertama. Naik jadi Rp2.400/km jika jarak >25 km',
    8000, 3
  ),
  (
    'Lalamove - MPV',
    'mobil', 'per_km', 4500, 350,
    NULL, 'Lalamove',
    'Tarif dasar Rp24.000 (termasuk 3 km pertama). Naik jadi Rp5.000/km jika jarak >15 km',
    24000, 3
  ),
  (
    'Lalamove - Van',
    'mobil', 'per_km', 4500, 600,
    NULL, 'Lalamove',
    'Tarif dasar minimum Rp90.000 (termasuk 5 km pertama)',
    90000, 5
  ),
  (
    'Lalamove - Pick Up Bak',
    'pickup', 'per_km', 5000, 800,
    NULL, 'Lalamove',
    'Tarif dasar Rp95.000 (termasuk 3 km pertama). Turun jadi Rp4.200/km jika jarak >12 km',
    95000, 3
  ),
  (
    'Lalamove - Truk Engkel Box',
    'truk', 'per_km', 5000, 2000,
    NULL, 'Lalamove',
    'Tarif dasar Rp270.000 (termasuk 1 km pertama). Naik jadi Rp6.500/km jika jarak >30 km',
    270000, 1
  );

-- ── ASDP Jawa–Bali (Ketapang–Gilimanuk) ────────────────────────────────────
INSERT INTO transport_vendors
  (name, moda, pricing_type, price, capacity_kg, coverage, contact, notes, base_fare_rp, base_km)
VALUES
  (
    'ASDP Ketapang-Gilimanuk Gol.IVB',
    'kapal', 'flat_per_trip', 192200, NULL,
    'Jawa → Bali (Ketapang–Gilimanuk)', 'PT ASDP',
    'Gol. IVB – Pick Up/Barang <5m',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Gilimanuk Gol.VB',
    'kapal', 'flat_per_trip', 326200, NULL,
    'Jawa → Bali (Ketapang–Gilimanuk)', 'PT ASDP',
    'Gol. VB – Truk Sedang <7m',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Gilimanuk Gol.VIB',
    'kapal', 'flat_per_trip', 534300, NULL,
    'Jawa → Bali (Ketapang–Gilimanuk)', 'PT ASDP',
    'Gol. VIB – Truk Besar <10m',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Gilimanuk Gol.VII',
    'kapal', 'flat_per_trip', 664100, NULL,
    'Jawa → Bali (Ketapang–Gilimanuk)', 'PT ASDP',
    'Gol. VII – Tronton/Trailer <12m',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Gilimanuk Gol.VIII',
    'kapal', 'flat_per_trip', 897600, NULL,
    'Jawa → Bali (Ketapang–Gilimanuk)', 'PT ASDP',
    'Gol. VIII – Trailer <16m',
    NULL, NULL
  );

-- ── ASDP Jawa–Lombok LDF (Ketapang–Lembar) ─────────────────────────────────
INSERT INTO transport_vendors
  (name, moda, pricing_type, price, capacity_kg, coverage, contact, notes, base_fare_rp, base_km)
VALUES
  (
    'ASDP Ketapang-Lembar LDF Gol.IV',
    'kapal', 'flat_per_trip', 1042510, NULL,
    'Jawa → Lombok (Ketapang–Lembar)', 'PT ASDP',
    'Gol. IV Barang – Pick Up/Barang <5m. Long Distance Ferry',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Lembar LDF Gol.V',
    'kapal', 'flat_per_trip', 1870815, NULL,
    'Jawa → Lombok (Ketapang–Lembar)', 'PT ASDP',
    'Gol. V Barang – Truk Sedang <7m. Long Distance Ferry',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Lembar LDF Gol.VI',
    'kapal', 'flat_per_trip', 2937470, NULL,
    'Jawa → Lombok (Ketapang–Lembar)', 'PT ASDP',
    'Gol. VI Barang – Truk Besar <10m. Long Distance Ferry',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Lembar LDF Gol.VII',
    'kapal', 'flat_per_trip', 3872770, NULL,
    'Jawa → Lombok (Ketapang–Lembar)', 'PT ASDP',
    'Gol. VII – Tronton/Trailer <12m. Long Distance Ferry',
    NULL, NULL
  ),
  (
    'ASDP Ketapang-Lembar LDF Gol.VIII',
    'kapal', 'flat_per_trip', 5212110, NULL,
    'Jawa → Lombok (Ketapang–Lembar)', 'PT ASDP',
    'Gol. VIII – Trailer <16m. Long Distance Ferry',
    NULL, NULL
  );
