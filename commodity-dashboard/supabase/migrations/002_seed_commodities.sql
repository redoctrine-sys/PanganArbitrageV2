-- ═══════════════════════════════════════
-- 002 — Seed 17 komoditas SP2KP (idempotent)
-- ═══════════════════════════════════════

INSERT INTO commodities (name, unit, category, is_sp2kp) VALUES
  ('Bawang Merah',                       'kg',    'bumbu',   true),
  ('Bawang Putih Honan',                 'kg',    'bumbu',   true),
  ('Beras Medium',                       'kg',    'pokok',   true),
  ('Beras Premium',                      'kg',    'pokok',   true),
  ('Cabai Merah Besar',                  'kg',    'bumbu',   true),
  ('Cabai Merah Keriting',               'kg',    'bumbu',   true),
  ('Cabai Rawit Merah',                  'kg',    'bumbu',   true),
  ('Daging Ayam Ras',                    'kg',    'protein', true),
  ('Daging Sapi Paha Belakang',          'kg',    'protein', true),
  ('Garam Halus',                        'kg',    'pokok',   true),
  ('Gula Pasir Curah',                   'kg',    'pokok',   true),
  ('Ikan Kembung',                       'kg',    'protein', true),
  ('Minyak Goreng Sawit Curah',          'liter', 'pokok',   true),
  ('Minyak Goreng Sawit Kemasan Premium','liter', 'pokok',   true),
  ('Minyakita',                          'liter', 'pokok',   true),
  ('Telur Ayam Ras',                     'kg',    'protein', true),
  ('Tepung Terigu',                      'kg',    'pokok',   true)
ON CONFLICT (name) DO NOTHING;
