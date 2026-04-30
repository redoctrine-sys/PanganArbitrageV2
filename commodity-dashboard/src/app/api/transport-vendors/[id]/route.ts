import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, name, moda, pricing_type, price, capacity_kg, coverage, contact, notes, base_fare_rp, base_km";

const validModa = ["truk", "pickup", "kapal", "motor", "mobil", "lainnya"];
const validPricing = ["per_km", "flat_per_trip"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "name tidak boleh kosong" }, { status: 400 });
    update.name = n;
  }
  if (body.moda !== undefined) {
    if (!validModa.includes(body.moda as string))
      return NextResponse.json({ error: "moda tidak valid" }, { status: 400 });
    update.moda = body.moda;
  }
  if (body.pricing_type !== undefined) {
    if (!validPricing.includes(body.pricing_type as string))
      return NextResponse.json({ error: "pricing_type tidak valid" }, { status: 400 });
    update.pricing_type = body.pricing_type;
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0)
      return NextResponse.json({ error: "price harus angka positif" }, { status: 400 });
    update.price = p;
  }
  if (body.capacity_kg !== undefined) {
    update.capacity_kg = body.capacity_kg != null ? Number(body.capacity_kg) : null;
  }
  if (body.coverage !== undefined) {
    update.coverage = body.coverage ? String(body.coverage).trim() || null : null;
  }
  if (body.contact !== undefined) {
    update.contact = body.contact ? String(body.contact).trim() || null : null;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes ? String(body.notes).trim() || null : null;
  }
  if (body.base_fare_rp !== undefined) {
    update.base_fare_rp = body.base_fare_rp != null ? Number(body.base_fare_rp) : null;
  }
  if (body.base_km !== undefined) {
    update.base_km = body.base_km != null ? Number(body.base_km) : null;
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  let sb;
  try { sb = getServiceClient(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Service client error" }, { status: 500 });
  }

  const { data, error } = await sb
    .from("transport_vendors")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  let sb;
  try { sb = getServiceClient(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Service client error" }, { status: 500 });
  }

  const { error, count } = await sb
    .from("transport_vendors")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "Vendor tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
