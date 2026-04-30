-- ═══════════════════════════════════════
-- 011 — Seed koordinat lat/lng dari cities-lat-long.json
--
-- Sumber: PanganArbitrageV2/cities lat long.json (100 kota)
-- Match: LOWER(c.name) = LOWER(cr.name) AND c.province = cr.province
-- Overwrite: selalu update (termasuk kota yang sudah punya koordinat)
-- Re-runnable: idempotent (UPDATE selalu boleh di-ulang)
-- ═══════════════════════════════════════

WITH coords (province, name, lat, lng) AS (
  VALUES
    -- ── Jawa Barat (27 kota) ──────────────────────────────────────────────
    ('Jawa Barat', 'Kota Bandung',       -6.9175::numeric,  107.6191::numeric),
    ('Jawa Barat', 'Kota Bekasi',        -6.2383::numeric,  106.9756::numeric),
    ('Jawa Barat', 'Kota Depok',         -6.4025::numeric,  106.7942::numeric),
    ('Jawa Barat', 'Kota Bogor',         -6.5971::numeric,  106.8060::numeric),
    ('Jawa Barat', 'Kota Tasikmalaya',   -7.3274::numeric,  108.2207::numeric),
    ('Jawa Barat', 'Kota Cimahi',        -6.8722::numeric,  107.5432::numeric),
    ('Jawa Barat', 'Kota Sukabumi',      -6.9277::numeric,  106.9300::numeric),
    ('Jawa Barat', 'Kota Cirebon',       -6.7063::numeric,  108.5570::numeric),
    ('Jawa Barat', 'Kota Banjar',        -7.3711::numeric,  108.5367::numeric),
    ('Jawa Barat', 'Kab. Bogor',         -6.4847::numeric,  106.8297::numeric),
    ('Jawa Barat', 'Kab. Sukabumi',      -6.9181::numeric,  106.9263::numeric),
    ('Jawa Barat', 'Kab. Cianjur',       -6.8219::numeric,  107.1397::numeric),
    ('Jawa Barat', 'Kab. Bandung',       -7.0252::numeric,  107.5197::numeric),
    ('Jawa Barat', 'Kab. Garut',         -7.2279::numeric,  107.9087::numeric),
    ('Jawa Barat', 'Kab. Tasikmalaya',   -7.3534::numeric,  108.1256::numeric),
    ('Jawa Barat', 'Kab. Ciamis',        -7.3255::numeric,  108.3533::numeric),
    ('Jawa Barat', 'Kab. Kuningan',      -6.9765::numeric,  108.4846::numeric),
    ('Jawa Barat', 'Kab. Cirebon',       -6.7646::numeric,  108.4789::numeric),
    ('Jawa Barat', 'Kab. Majalengka',    -6.8364::numeric,  108.2274::numeric),
    ('Jawa Barat', 'Kab. Sumedang',      -6.8584::numeric,  107.9194::numeric),
    ('Jawa Barat', 'Kab. Indramayu',     -6.3271::numeric,  108.3249::numeric),
    ('Jawa Barat', 'Kab. Subang',        -6.5716::numeric,  107.7587::numeric),
    ('Jawa Barat', 'Kab. Purwakarta',    -6.5516::numeric,  107.4445::numeric),
    ('Jawa Barat', 'Kab. Karawang',      -6.3024::numeric,  107.3077::numeric),
    ('Jawa Barat', 'Kab. Bekasi',        -6.3643::numeric,  107.1725::numeric),
    ('Jawa Barat', 'Kab. Bandung Barat', -6.8247::numeric,  107.5222::numeric),
    ('Jawa Barat', 'Kab. Pangandaran',   -7.7011::numeric,  108.4947::numeric),

    -- ── Jawa Tengah (35 kota) ─────────────────────────────────────────────
    ('Jawa Tengah', 'Kota Semarang',    -7.0051::numeric,  110.4381::numeric),
    ('Jawa Tengah', 'Kota Surakarta',   -7.5703::numeric,  110.8271::numeric),
    ('Jawa Tengah', 'Kota Magelang',    -7.4706::numeric,  110.2177::numeric),
    ('Jawa Tengah', 'Kota Pekalongan',  -6.8886::numeric,  109.6753::numeric),
    ('Jawa Tengah', 'Kota Salatiga',    -7.3305::numeric,  110.5084::numeric),
    ('Jawa Tengah', 'Kota Tegal',       -6.8676::numeric,  109.1371::numeric),
    ('Jawa Tengah', 'Kab. Cilacap',     -7.7277::numeric,  109.0074::numeric),
    ('Jawa Tengah', 'Kab. Banyumas',    -7.4533::numeric,  109.2081::numeric),
    ('Jawa Tengah', 'Kab. Purbalingga', -7.3875::numeric,  109.3644::numeric),
    ('Jawa Tengah', 'Kab. Banjarnegara',-7.3971::numeric,  109.6974::numeric),
    ('Jawa Tengah', 'Kab. Kebumen',     -7.6711::numeric,  109.6581::numeric),
    ('Jawa Tengah', 'Kab. Purworejo',   -7.7126::numeric,  110.0093::numeric),
    ('Jawa Tengah', 'Kab. Wonosobo',    -7.3615::numeric,  109.9001::numeric),
    ('Jawa Tengah', 'Kab. Magelang',    -7.4764::numeric,  110.2227::numeric),
    ('Jawa Tengah', 'Kab. Boyolali',    -7.5317::numeric,  110.5964::numeric),
    ('Jawa Tengah', 'Kab. Klaten',      -7.7025::numeric,  110.6032::numeric),
    ('Jawa Tengah', 'Kab. Sukoharjo',   -7.6833::numeric,  110.8417::numeric),
    ('Jawa Tengah', 'Kab. Wonogiri',    -7.8189::numeric,  110.9254::numeric),
    ('Jawa Tengah', 'Kab. Karanganyar', -7.5938::numeric,  110.9507::numeric),
    ('Jawa Tengah', 'Kab. Sragen',      -7.4285::numeric,  111.0255::numeric),
    ('Jawa Tengah', 'Kab. Grobogan',    -7.1090::numeric,  110.9194::numeric),
    ('Jawa Tengah', 'Kab. Blora',       -7.0006::numeric,  111.4172::numeric),
    ('Jawa Tengah', 'Kab. Rembang',     -6.7088::numeric,  111.3364::numeric),
    ('Jawa Tengah', 'Kab. Pati',        -6.7494::numeric,  111.0381::numeric),
    ('Jawa Tengah', 'Kab. Kudus',       -6.8080::numeric,  110.8422::numeric),
    ('Jawa Tengah', 'Kab. Jepara',      -6.5862::numeric,  110.6726::numeric),
    ('Jawa Tengah', 'Kab. Demak',       -6.8944::numeric,  110.6387::numeric),
    ('Jawa Tengah', 'Kab. Semarang',    -7.2215::numeric,  110.4357::numeric),
    ('Jawa Tengah', 'Kab. Temanggung',  -7.3182::numeric,  110.1770::numeric),
    ('Jawa Tengah', 'Kab. Kendal',      -6.9189::numeric,  110.2033::numeric),
    ('Jawa Tengah', 'Kab. Batang',      -6.9048::numeric,  109.7303::numeric),
    ('Jawa Tengah', 'Kab. Pekalongan',  -7.0261::numeric,  109.5891::numeric),
    ('Jawa Tengah', 'Kab. Pemalang',    -6.8906::numeric,  109.3813::numeric),
    ('Jawa Tengah', 'Kab. Tegal',       -6.9856::numeric,  109.1396::numeric),
    ('Jawa Tengah', 'Kab. Brebes',      -6.8705::numeric,  109.0375::numeric),

    -- ── Jawa Timur (38 kota) ──────────────────────────────────────────────
    ('Jawa Timur', 'Kota Surabaya',    -7.2575::numeric,  112.7521::numeric),
    ('Jawa Timur', 'Kota Malang',      -7.9839::numeric,  112.6214::numeric),
    ('Jawa Timur', 'Kota Kediri',      -7.8480::numeric,  112.0178::numeric),
    ('Jawa Timur', 'Kota Madiun',      -7.6298::numeric,  111.5239::numeric),
    ('Jawa Timur', 'Kota Blitar',      -8.0954::numeric,  112.1609::numeric),
    ('Jawa Timur', 'Kota Pasuruan',    -7.6449::numeric,  112.9033::numeric),
    ('Jawa Timur', 'Kota Probolinggo', -7.7569::numeric,  113.2161::numeric),
    ('Jawa Timur', 'Kota Mojokerto',   -7.4727::numeric,  112.4381::numeric),
    ('Jawa Timur', 'Kota Batu',        -7.8707::numeric,  112.5271::numeric),
    ('Jawa Timur', 'Kab. Gresik',      -7.1566::numeric,  112.6555::numeric),
    ('Jawa Timur', 'Kab. Sidoarjo',    -7.4478::numeric,  112.7183::numeric),
    ('Jawa Timur', 'Kab. Mojokerto',   -7.4705::numeric,  112.4401::numeric),
    ('Jawa Timur', 'Kab. Jombang',     -7.5461::numeric,  112.2331::numeric),
    ('Jawa Timur', 'Kab. Bojonegoro',  -7.1502::numeric,  111.8817::numeric),
    ('Jawa Timur', 'Kab. Tuban',       -6.8976::numeric,  112.0649::numeric),
    ('Jawa Timur', 'Kab. Lamongan',    -7.1282::numeric,  112.4131::numeric),
    ('Jawa Timur', 'Kab. Magetan',     -7.6542::numeric,  111.3281::numeric),
    ('Jawa Timur', 'Kab. Ngawi',       -7.4039::numeric,  111.4449::numeric),
    ('Jawa Timur', 'Kab. Ponorogo',    -7.8667::numeric,  111.4667::numeric),
    ('Jawa Timur', 'Kab. Pacitan',     -8.2031::numeric,  111.0925::numeric),
    ('Jawa Timur', 'Kab. Trenggalek',  -8.0494::numeric,  111.7119::numeric),
    ('Jawa Timur', 'Kab. Tulungagung', -8.0667::numeric,  111.9000::numeric),
    ('Jawa Timur', 'Kab. Nganjuk',     -7.6044::numeric,  111.9044::numeric),
    ('Jawa Timur', 'Kab. Pasuruan',    -7.6432::numeric,  112.9064::numeric),
    ('Jawa Timur', 'Kab. Probolinggo', -7.7544::numeric,  113.2201::numeric),
    ('Jawa Timur', 'Kab. Lumajang',    -8.1333::numeric,  113.2244::numeric),
    ('Jawa Timur', 'Kab. Jember',      -8.1724::numeric,  113.6995::numeric),
    ('Jawa Timur', 'Kab. Bondowoso',   -7.9135::numeric,  113.8214::numeric),
    ('Jawa Timur', 'Kab. Situbondo',   -7.7067::numeric,  113.9939::numeric),
    ('Jawa Timur', 'Kab. Banyuwangi',  -8.2192::numeric,  114.3691::numeric),
    ('Jawa Timur', 'Kab. Bangkalan',   -7.0279::numeric,  112.7483::numeric),
    ('Jawa Timur', 'Kab. Sampang',     -7.0601::numeric,  113.2541::numeric),
    ('Jawa Timur', 'Kab. Pamekasan',   -7.1121::numeric,  113.4862::numeric),
    ('Jawa Timur', 'Kab. Sumenep',     -6.9947::numeric,  113.8821::numeric),

    -- Kota Kediri dan Kab. Kediri punya nama berbeda di SP2KP — fallback dengan
    -- province match. Kota Madiun, dll. sudah tercakup di atas.
    ('Jawa Timur', 'Kab. Kediri',      -7.8188::numeric,  111.9674::numeric),
    ('Jawa Timur', 'Kab. Malang',      -8.1597::numeric,  112.6197::numeric),
    ('Jawa Timur', 'Kab. Blitar',      -8.1011::numeric,  112.1877::numeric),
    ('Jawa Timur', 'Kab. Madiun',      -7.6533::numeric,  111.5261::numeric)
)
UPDATE cities c
SET
  lat = cr.lat,
  lng = cr.lng
FROM coords cr
WHERE c.province = cr.province
  AND LOWER(c.name) = LOWER(cr.name);

-- Verifikasi: berapa kota yang ter-update
-- SELECT province, COUNT(*) FILTER (WHERE lat IS NOT NULL) AS with_coord, COUNT(*) AS total
-- FROM cities GROUP BY province ORDER BY province;
