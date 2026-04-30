import { NextResponse } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let sb;
  try { sb = getServerClient(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Supabase error", data: [] }, { status: 200 });
  }
  const { data, error } = await sb
    .from("transport_vendors")
    .select("id, name, moda, pricing_type, price, capacity_kg, coverage, contact, notes")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
  return NextResponse.json({ data: data ?? [] }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }

  const { name, moda, pricing_type, price, capacity_kg, coverage, contact, notes } = body;

  if (!name || typeof name !== "string" || !(name as string).trim()) {
    return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });
  }
  const validModa = ["truk", "pickup", "kapal", "motor", "lainnya"];
  if (!validModa.includes(moda as string)) {
    return NextResponse.json({ error: "moda tidak valid" }, { status: 400 });
  }
  const validPricing = ["per_km", "flat_per_trip"];
  if (!validPricing.includes(pricing_type as string)) {
    return NextResponse.json({ error: "pricing_type tidak valid" }, { status: 400 });
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return NextResponse.json({ error: "price harus angka positif" }, { status: 400 });
  }

  let sb;
  try { sb = getServiceClient(); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Service client error" }, { status: 500 });
  }

  const insert = {
    name: (name as string).trim(),
    moda: moda as string,
    pricing_type: pricing_type as string,
    price: priceNum,
    capacity_kg: capacity_kg != null ? Number(capacity_kg) : null,
    coverage: coverage ? String(coverage).trim() || null : null,
    contact: contact ? String(contact).trim() || null : null,
    notes: notes ? String(notes).trim() || null : null,
  };

  const { data, error } = await sb
    .from("transport_vendors")
    .insert(insert)
    .select("id, name, moda, pricing_type, price, capacity_kg, coverage, contact, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
