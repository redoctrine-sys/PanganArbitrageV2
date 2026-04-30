-- ═══════════════════════════════════════
-- 010 — Hard-seed 6 kota administrasi DKI Jakarta
--
-- Problem: get_sp2kp_latest() (migration 009) menggunakan scope_cities × commodities
-- sebagai basis baris. scope_cities membaca dari tabel cities. Kota-kota DKI Jakarta
-- tidak pernah masuk tabel cities karena:
--   1. CSV SP2KP nasional biasanya tidak menyertakan data harga Jakarta, ATAU
--   2. Commodity names di CSV tidak match exact ke 17 seeded commodities
--      → commodity_id = NULL → auto_seed_cities() seeding kota OK tapi prices tidak tampil
--
-- Solusi: hard-seed 6 kota administrasi Jakarta dengan kode BPS standard.
-- ON CONFLICT DO NOTHING → idempotent, aman dijalankan ulang.
-- Setelah insert, panggil auto_seed_cities() untuk backfill city_id di prices_raw
-- apabila ada Jakarta rows yang sudah teringest sebelumnya.
--
-- Kode BPS DKI Jakarta (31XX):
--   3101 = Kab. Adm. Kepulauan Seribu
--   3171 = Kota Adm. Jakarta Selatan
--   3172 = Kota Adm. Jakarta Timur
--   3173 = Kota Adm. Jakarta Pusat
--   3174 = Kota Adm. Jakarta Barat
--   3175 = Kota Adm. Jakarta Utara
-- ═══════════════════════════════════════

INSERT INTO cities (name, name_sp2kp, kode_wilayah, province, island, entity_type)
VALUES
  ('Kab. Adm. Kepulauan Seribu', 'Kab. Adm. Kepulauan Seribu', '3101', 'DKI Jakarta', 'Jawa', 'kabupaten'),
  ('Kota Adm. Jakarta Selatan',  'Kota Adm. Jakarta Selatan',  '3171', 'DKI Jakarta', 'Jawa', 'kota'),
  ('Kota Adm. Jakarta Timur',    'Kota Adm. Jakarta Timur',    '3172', 'DKI Jakarta', 'Jawa', 'kota'),
  ('Kota Adm. Jakarta Pusat',    'Kota Adm. Jakarta Pusat',    '3173', 'DKI Jakarta', 'Jawa', 'kota'),
  ('Kota Adm. Jakarta Barat',    'Kota Adm. Jakarta Barat',    '3174', 'DKI Jakarta', 'Jawa', 'kota'),
  ('Kota Adm. Jakarta Utara',    'Kota Adm. Jakarta Utara',    '3175', 'DKI Jakarta', 'Jawa', 'kota')
ON CONFLICT (kode_wilayah) DO NOTHING;

-- Backfill city_id di prices_raw untuk Jakarta rows yang sudah teringest
-- (auto_seed_cities() skip kota yang sudah ada, tapi tetap jalankan
--  step backfill untuk rows dengan kode_wilayah 31xx yang city_id masih NULL)
SELECT auto_seed_cities();

NOTIFY pgrst, 'reload schema';
