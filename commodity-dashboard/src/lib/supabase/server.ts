import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Sanitize: trim whitespace + strip trailing slash + strip `/rest/v1` suffix.
// Env vars yang di-paste dari Supabase Dashboard sering punya trailing slash,
// newline, atau lebih jarang: user copy REST API endpoint (...supabase.co/rest/v1)
// alih-alih project URL. Semua membuat SDK membentuk URL malformed
// (mis. `https://xyz.supabase.co/rest/v1/rest/v1/rpc/...` double-prefix)
// → REST endpoint balik "Invalid path specified in request URL".
function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let trimmed = raw.trim().replace(/\/+$/, "");
  // Strip /rest/v1 suffix kalau ada (user paste REST endpoint instead of project URL)
  trimmed = trimmed.replace(/\/rest\/v1$/, "");
  if (!/^https?:\/\//.test(trimmed)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL invalid (harus diawali https://): "${trimmed.slice(0, 50)}"`,
    );
  }
  return trimmed;
}

function cleanKey(raw: string | undefined): string | undefined {
  return raw?.trim();
}

const url     = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anon    = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const service = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getServerClient(): SupabaseClient {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set");
  return createClient(url, anon, { auth: { persistSession: false } });
}

export function getServiceClient(): SupabaseClient {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set");
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum di-set (wajib utk ingest)");
  return createClient(url, service, { auth: { persistSession: false } });
}

// Expose cleaned URL untuk diagnostics (tanpa key) — dipakai di error response.
export function getSupabaseUrlPrefix(): string {
  return url ?? "(unset)";
}
