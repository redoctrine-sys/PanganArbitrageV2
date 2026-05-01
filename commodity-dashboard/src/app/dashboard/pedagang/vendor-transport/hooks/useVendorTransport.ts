"use client";

import { useState } from "react";
import type { AddRouteFormState, TransportRoute, VehicleType } from "../types/vendor";

const EMPTY_FORM: AddRouteFormState = {
  fromCity: "",
  toCity: "",
  vehicleType: "engkel",
  costPerKg: "",
  distanceKm: "",
  notes: "",
};

export function useVendorTransport() {
  // In-memory state for Phase 1 scaffold.
  // Phase 2: replace with Supabase CRUD via /api/vendor/transport.
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddRouteFormState>(EMPTY_FORM);

  function patchForm(patch: Partial<AddRouteFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function submitRoute() {
    const costPerKg = Number(form.costPerKg);
    if (!form.fromCity || !form.toCity || !costPerKg) return;

    const newRoute: TransportRoute = {
      id: crypto.randomUUID(),
      fromKode: "",
      fromCity: form.fromCity,
      toKode: "",
      toCity: form.toCity,
      vehicleType: form.vehicleType as VehicleType,
      costPerKg,
      distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    };
    setRoutes((prev) => [newRoute, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function deleteRoute(id: string) {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }

  return {
    routes,
    showForm,
    setShowForm,
    form,
    patchForm,
    submitRoute,
    deleteRoute,
  };
}
