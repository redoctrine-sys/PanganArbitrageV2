export type VehicleType = "pickup" | "engkel" | "truk" | "kontainer";

export interface TransportRoute {
  id: string;
  fromKode: string;
  fromCity: string;
  toKode: string;
  toCity: string;
  vehicleType: VehicleType;
  costPerKg: number;
  distanceKm: number | null;
  notes: string;
  createdAt: string;
}

export interface AddRouteFormState {
  fromCity: string;
  toCity: string;
  vehicleType: VehicleType;
  costPerKg: string;
  distanceKm: string;
  notes: string;
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  pickup: "Pickup",
  engkel: "Engkel",
  truk: "Truk",
  kontainer: "Kontainer",
};
