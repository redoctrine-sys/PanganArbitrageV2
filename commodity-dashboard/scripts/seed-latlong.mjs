/**
 * Seed lat/lng into the cities table from "cities lat long.json".
 *
 * Run from commodity-dashboard/:
 *   node --env-file .env.local scripts/seed-latlong.mjs
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Supabase client ────────────────────────────────────────────────────────
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !rawKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY wajib ada.");
  console.error("Buat .env.local lalu jalankan: node --env-file .env.local scripts/seed-latlong.mjs");
  process.exit(1);
}

const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const key = rawKey.trim();
const sb  = createClient(url, key, { auth: { persistSession: false } });

// ── Parse JSON (two arrays concatenated = invalid JSON) ────────────────────
const jsonPath = resolve(__dirname, "../../cities lat long.json");
const raw = readFileSync(jsonPath, "utf8");

function parseFile(raw) {
  // File structure: [ ...arr1... \n[ ...arr2... ]
  // The first array has no closing ] before the second [ begins.
  // Normalize CRLF → LF so boundary detection works on Windows files.
  const normalized = raw.replace(/\r\n/g, "\n");

  // Find position of [ preceded by \n (skip position 0 which is the opening [).
  const boundaries = [];
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i] === "[" && normalized[i - 1] === "\n") boundaries.push(i);
  }

  if (boundaries.length === 0) {
    return JSON.parse(normalized);
  }

  const splitAt = boundaries[0];
  const part1 = normalized.substring(0, splitAt).trimEnd() + "\n]";
  // The outer array wraps everything — its closing ] trails after the inner array's ].
  // Strip it so part2 is only the inner [ ... ].
  let part2 = normalized.substring(splitAt).trimEnd();
  if (part2.endsWith("]")) part2 = part2.slice(0, -1).trimEnd();
  return [...JSON.parse(part1), ...JSON.parse(part2)];
}

const rawEntries = parseFile(raw);

// ── Normalize two field-name formats ──────────────────────────────────────
// Format A: { province, name, lat, lng }
// Format B: { kode, nama_wilayah, provinsi, latitude, longitude }
function normalize(e) {
  if (e.name !== undefined) {
    return { name: e.name, province: e.province, lat: e.lat, lng: e.lng, kode: null };
  }
  return {
    name: e.nama_wilayah,
    province: e.provinsi,
    lat: e.latitude,
    lng: e.longitude,
    kode: String(e.kode),
  };
}

const entries = rawEntries.map(normalize);
console.log(`JSON: ${entries.length} entries parsed`);

// ── Fetch all cities from DB ───────────────────────────────────────────────
const { data: cities, error: fetchErr } = await sb
  .from("cities")
  .select("id, kode_wilayah, name, province, lat, lng")
  .limit(2000);

if (fetchErr) {
  console.error("Fetch cities error:", fetchErr.message);
  process.exit(1);
}
console.log(`DB: ${cities.length} cities fetched`);

// ── Match and update ───────────────────────────────────────────────────────
let updated = 0;
let skipped = 0;
const unmatched = [];

for (const entry of entries) {
  // Match by kode_wilayah first (exact, format B only), then by name
  let match = null;

  if (entry.kode) {
    match = cities.find((c) => c.kode_wilayah === entry.kode);
  }

  if (!match) {
    // Exact name match, narrow by province if multiple hits
    const byName = cities.filter(
      (c) => c.name?.toLowerCase() === entry.name?.toLowerCase()
    );
    if (byName.length === 1) {
      match = byName[0];
    } else if (byName.length > 1) {
      match = byName.find(
        (c) => c.province?.toLowerCase() === entry.province?.toLowerCase()
      );
    }
  }

  if (!match) {
    unmatched.push(`${entry.province} / ${entry.name}`);
    continue;
  }

  // Skip if lat/lng already set to same value (avoid unnecessary writes)
  if (match.lat === entry.lat && match.lng === entry.lng) {
    skipped++;
    continue;
  }

  const { error } = await sb
    .from("cities")
    .update({ lat: entry.lat, lng: entry.lng })
    .eq("id", match.id);

  if (error) {
    console.error(`  FAIL [${match.id}] ${match.name}: ${error.message}`);
  } else {
    console.log(`  OK  ${match.province} / ${match.name} → (${entry.lat}, ${entry.lng})`);
    updated++;
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n✓ Updated: ${updated}  Skipped (already set): ${skipped}  Unmatched: ${unmatched.length}`);

if (unmatched.length > 0) {
  console.log("\nUnmatched (city not in DB or name differs):");
  unmatched.forEach((u) => console.log("  -", u));
}
