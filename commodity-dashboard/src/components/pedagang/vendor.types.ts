export type Moda = "truk" | "pickup" | "kapal" | "motor" | "mobil" | "lainnya";
export type PricingType = "per_km" | "flat_per_trip";

export interface Vendor {
  id: string;
  name: string;
  moda: Moda;
  pricing_type: PricingType;
  price: number;
  capacity_kg: number | null;
  coverage: string | null;
  contact: string | null;
  notes: string | null;
  base_fare_rp: number | null;
  base_km: number | null;
}

export const MODA_LABELS: Record<Moda, string> = {
  truk: "🚛 Truk",
  pickup: "🛻 Pickup",
  kapal: "⛴ Kapal",
  motor: "🏍 Motor",
  mobil: "🚗 Mobil",
  lainnya: "📦 Lainnya",
};

export const MODA_PILL: Record<Moda, string> = {
  truk: "pill-mid",
  pickup: "pill-lo",
  kapal: "pill-sp",
  motor: "pill-warn",
  mobil: "pill-hi",
  lainnya: "pill-neu",
};

export const MODA_FILTERS = [
  "Semua", "Truk", "Pickup", "Kapal", "Motor", "Mobil", "Lainnya",
] as const;

export function fmtRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function formatPrice(v: Vendor) {
  return v.pricing_type === "per_km" ? `${fmtRp(v.price)}/km` : fmtRp(v.price);
}

export function formatPricingType(t: PricingType) {
  return t === "per_km" ? "Per km" : "Flat/trip";
}
