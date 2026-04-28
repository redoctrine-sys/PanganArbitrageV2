-- ═══════════════════════════════════════
-- 008 — SECURITY DEFINER on get_sp2kp_latest()
--
-- Symptom yang muncul setelah deploy: anon-key RPC call dengan p_province
-- silently mengembalikan 0 rows, walau raw SQL `SELECT FROM
-- get_sp2kp_latest(NULL,'Jawa Tengah')` (juga sebagai role anon via
-- SET ROLE) menghasilkan 567 rows. ?island=<x> bekerja, ?province=<x>
-- gagal — masalah hanya muncul lewat PostgREST + JS client + parameter
-- p_province.
--
-- Root cause kemungkinan: interaksi antara new sb_publishable_* anon key,
-- PostgREST schema cache, dan SECURITY INVOKER context untuk RPC dengan
-- named parameters. NOTIFY pgrst, 'reload schema' tidak menyelesaikan.
--
-- Fix: jalankan fungsi sebagai SECURITY DEFINER. Aman karena fungsi
-- read-only, hanya melakukan SELECT pada data yang memang ditujukan
-- untuk public display (RLS policy `prices_raw_public_read_sp2kp`
-- sudah mengizinkan public read). Tidak ada path eskalasi privilege.
--
-- Re-runnable.
-- ═══════════════════════════════════════

ALTER FUNCTION get_sp2kp_latest(text, text) SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
