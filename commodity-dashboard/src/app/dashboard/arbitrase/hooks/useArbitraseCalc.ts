"use client";

import { useEffect, useMemo, useState } from "react";
import type { SP2KPLatestRow } from "@/types/sp2kp";
import type {
  ArbitraseCalcResult,
  ArbitraseInput,
  CityOption,
  CommodityOption,
} from "../types/arbitrase";

const DEFAULT_INPUT: ArbitraseInput = {
  commodityId: null,
  sourceKode: null,
  destKode: null,
  transportCostPerKg: 500,
  volumeKg: 1000,
};

export function useArbitraseCalc() {
  const [data, setData] = useState<SP2KPLatestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<ArbitraseInput>(DEFAULT_INPUT);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sp2kp/latest");
        const json = await res.json();
        if (!cancel) {
          if (json.error) setError(json.error);
          setData((json.data ?? []) as SP2KPLatestRow[]);
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Gagal memuat data");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  const commodities = useMemo<CommodityOption[]>(() => {
    const map = new Map<string, CommodityOption>();
    for (const r of data) {
      if (!map.has(r.commodity_id)) {
        map.set(r.commodity_id, { id: r.commodity_id, name: r.commodity_name, unit: r.unit });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const citiesForCommodity = useMemo<CityOption[]>(() => {
    const rows = input.commodityId
      ? data.filter((r) => r.commodity_id === input.commodityId)
      : data;
    const map = new Map<string, CityOption>();
    for (const r of rows) {
      if (!map.has(r.kode_wilayah)) {
        map.set(r.kode_wilayah, { kode: r.kode_wilayah, name: r.city_raw, province: r.province });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, input.commodityId]);

  const result = useMemo<ArbitraseCalcResult | null>(() => {
    const { commodityId, sourceKode, destKode, transportCostPerKg, volumeKg } = input;
    if (!commodityId || !sourceKode || !destKode || sourceKode === destKode) return null;

    const srcRow = data.find((r) => r.kode_wilayah === sourceKode && r.commodity_id === commodityId);
    const dstRow = data.find((r) => r.kode_wilayah === destKode && r.commodity_id === commodityId);
    if (!srcRow || !dstRow) return null;
    if (srcRow.price_latest == null || dstRow.price_latest == null) return null;
    const srcPrice = srcRow.price_latest;
    const dstPrice = dstRow.price_latest;

    const priceDiff = dstPrice - srcPrice;
    const netProfitPerUnit = priceDiff - transportCostPerKg;
    const capitalPerUnit = srcPrice + transportCostPerKg;
    const totalCapital = capitalPerUnit * volumeKg;
    const totalProfit = netProfitPerUnit * volumeKg;

    return {
      commodityName: srcRow.commodity_name,
      unit: srcRow.unit,
      sourceCity: srcRow.city_raw,
      destCity: dstRow.city_raw,
      priceSource: srcPrice,
      priceDest: dstPrice,
      priceDiff,
      transportCostPerKg,
      netProfitPerUnit,
      totalProfit,
      capitalPerUnit,
      totalCapital,
      marginPct: capitalPerUnit > 0 ? (netProfitPerUnit / capitalPerUnit) * 100 : 0,
      roiPct: totalCapital > 0 ? (totalProfit / totalCapital) * 100 : 0,
      isProfitable: netProfitPerUnit > 0,
      volumeKg,
    };
  }, [data, input]);

  function patchInput(patch: Partial<ArbitraseInput>) {
    setInput((prev) => ({ ...prev, ...patch }));
  }

  return { data, loading, error, input, patchInput, commodities, citiesForCommodity, result };
}
