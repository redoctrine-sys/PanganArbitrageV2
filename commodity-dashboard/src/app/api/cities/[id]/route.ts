import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  name?: string | null;
  name_sp2kp?: string | null;
  lat?: number | null;
  lng?: number | null;
}

function normalizeCoord(v: unknown, min: number, max: number): number | null | undefined {
  if (v === undefined) return undefined; // not provided → don't touch
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined; // invalid → reject below
  if (n < min || n > max) return undefined;
  return n;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }

  const update: Record<string, string | number | null> = {};
  if (body.name !== undefined) {
    const trimmed = body.name?.trim() ?? "";
    if (trimmed.length === 0) return NextResponse.json({ error: "name tidak boleh kosong" }, { status: 400 });
    update.name = trimmed;
  }
  if (body.name_sp2kp !== undefined) {
    update.name_sp2kp = body.name_sp2kp?.trim() ? body.name_sp2kp.trim() : null;
  }

  // Latitude valid for any place on Earth: -90..90.
  // Indonesia spans roughly -11..6 lat / 95..142 lng — use the planet ranges
  // so admins can still input nearby data without artificial barriers.
  const lat = normalizeCoord(body.lat, -90, 90);
  if (lat === undefined && body.lat !== undefined) {
    return NextResponse.json({ error: "lat di luar range -90..90" }, { status: 400 });
  }
  if (body.lat !== undefined) update.lat = lat ?? null;

  const lng = normalizeCoord(body.lng, -180, 180);
  if (lng === undefined && body.lng !== undefined) {
    return NextResponse.json({ error: "lng di luar range -180..180" }, { status: 400 });
  }
  if (body.lng !== undefined) update.lng = lng ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
  }

  let sb;
  try {
    sb = getServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase service-role belum dikonfigurasi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await sb
    .from("cities")
    .update(update)
    .eq("id", id)
    .select("id, kode_wilayah, name, name_sp2kp, province, island, entity_type, lat, lng")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kota tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data });
}
