import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getBrowserClient() {
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set di .env.local",
    );
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}
