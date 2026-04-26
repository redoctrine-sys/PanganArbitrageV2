import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getServerClient(): SupabaseClient {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  // Read-only API: pakai anon. Server-only context, tidak bocor ke client.
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set");
  return createClient(url, anon, { auth: { persistSession: false } });
}

export function getServiceClient(): SupabaseClient {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum di-set (wajib utk ingest)");
  return createClient(url, service, { auth: { persistSession: false } });
}
