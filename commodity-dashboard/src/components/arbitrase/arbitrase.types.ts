// @domain: arbitrase
// @feature: types-and-utils

export type Sub = "ai" | "manual";

export interface Vendor {
  id: string;
  name: string;
  moda: string;
  pricing_type: "per_km" | "flat_per_trip";
  price: number;
  capacity_kg: number | null;
  coverage: string | null;
  base_fare_rp: number | null;
  base_km: number | null;
}

export interface Leg {
  id: string;
  commodity: string;
  kotaBeli: string;
  kotaJual: string;
  hargaBeli: string;
  hargaJual: string;
  volumeKg: string;
  vendorId: string;
  jarakKm: string;
}

export interface LegResult {
  revenue: number;
  modalBeli: number;
  transportCost: number;
  netProfit: number;
  roi: number;
  trips: number;
  vendor: Vendor | null;
}

export const COMMODITIES = [
  "Bawang Merah", "Bawang Putih Honan", "Beras Medium", "Beras Premium",
  "Cabai Merah Besar", "Cabai Merah Keriting", "Cabai Rawit Merah",
  "Daging Ayam Ras", "Daging Sapi Paha Belakang", "Garam Halus",
  "Gula Pasir Curah", "Ikan Kembung", "Minyak Goreng Sawit Curah",
  "Minyak Goreng Sawit Kemasan Premium", "Minyakita", "Telur Ayam Ras",
  "Tepung Terigu",
];

export function fmtRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function calcTransportPerTrip(vendor: Vendor, jarakKm: number): number {
  if (vendor.pricing_type === "flat_per_trip") return vendor.price;
  if (jarakKm <= 0) return 0;
  if (vendor.base_fare_rp != null && vendor.base_km != null) {
    if (jarakKm <= vendor.base_km) return vendor.base_fare_rp;
    return vendor.base_fare_rp + (jarakKm - vendor.base_km) * vendor.price;
  }
  return jarakKm * vendor.price;
}

export function newLeg(): Leg {
  return {
    id: Math.random().toString(36).slice(2),
    commodity: "Cabai Rawit Merah",
    kotaBeli: "", kotaJual: "",
    hargaBeli: "", hargaJual: "",
    volumeKg: "1000", vendorId: "", jarakKm: "",
  };
}
