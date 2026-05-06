import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Max rows per Supabase fetch chunk (PostgREST default limit = 1000)
const CHUNK = 1000;

interface PriceRow {
  date: string;
  city_raw: string;
  commodity_raw: string;
  price: number;
  unit: string;
  market_name: string | null;
}

async function fetchAll(
  sb: ReturnType<typeof getServiceClient>,
  startDate: string,
  endDate: string,
  province: string | null,
  commodity: string | null,
): Promise<PriceRow[]> {
  const rows: PriceRow[] = [];
  let from = 0;

  while (true) {
    let q = sb
      .from("prices_raw")
      .select("date,city_raw,commodity_raw,price,unit,market_name")
      .eq("source", "pihps")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("city_raw", { ascending: true })
      .range(from, from + CHUNK - 1);

    if (province) q = q.ilike("city_raw", `%${province}%`);
    if (commodity) q = q.ilike("commodity_raw", `%${commodity}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...(data as PriceRow[]));
    if (data.length < CHUNK) break;
    from += CHUNK;
  }

  return rows;
}

function buildCsv(rows: PriceRow[]): string {
  const header = "Tanggal,Provinsi/Kota,Komoditas,Harga (Rp),Satuan,Jenis Pasar\r\n";
  const body = rows
    .map(
      (r) =>
        [
          r.date,
          `"${r.city_raw.replace(/"/g, '""')}"`,
          `"${r.commodity_raw.replace(/"/g, '""')}"`,
          r.price,
          r.unit,
          `"${(r.market_name ?? "").replace(/"/g, '""')}"`,
        ].join(","),
    )
    .join("\r\n");
  return header + body;
}

function buildXlsx(rows: PriceRow[]): Buffer {
  const sheet = rows.map((r) => ({
    Tanggal: r.date,
    "Provinsi/Kota": r.city_raw,
    Komoditas: r.commodity_raw,
    "Harga (Rp)": r.price,
    Satuan: r.unit,
    "Jenis Pasar": r.market_name ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(sheet);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, // Tanggal
    { wch: 28 }, // Provinsi/Kota
    { wch: 32 }, // Komoditas
    { wch: 14 }, // Harga
    { wch: 8 },  // Satuan
    { wch: 22 }, // Jenis Pasar
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PIHPS");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  const startDate = searchParams.get("start_date") ?? todayISO();
  const endDate = searchParams.get("end_date") ?? todayISO();
  const province = searchParams.get("province") || null;
  const commodity = searchParams.get("commodity") || null;

  if (!["csv", "xlsx"].includes(format)) {
    return NextResponse.json({ error: "format must be csv or xlsx" }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceClient>;
  try {
    sb = getServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase belum dikonfigurasi" },
      { status: 500 },
    );
  }

  let rows: PriceRow[];
  try {
    rows = await fetchAll(sb, startDate, endDate, province, commodity);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB error" },
      { status: 500 },
    );
  }

  const filename = `pihps_${startDate}_${endDate}.${format}`;

  if (format === "csv") {
    const csv = buildCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const buf = buildXlsx(rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
