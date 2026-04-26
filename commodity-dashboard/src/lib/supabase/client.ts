import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?.trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const url = rawUrl && /^https?:\/\//.test(rawUrl) ? rawUrl : undefined;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function getBrowserClient() {
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set di .env.local (atau URL tidak diawali https://)",
    );
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}
