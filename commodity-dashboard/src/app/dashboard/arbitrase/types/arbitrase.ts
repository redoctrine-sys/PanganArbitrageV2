export interface ArbitraseInput {
  commodityId: string | null;
  sourceKode: string | null;
  destKode: string | null;
  transportCostPerKg: number;
  volumeKg: number;
}

export interface ArbitraseCalcResult {
  commodityName: string;
  unit: string;
  sourceCity: string;
  destCity: string;
  priceSource: number;
  priceDest: number;
  priceDiff: number;
  transportCostPerKg: number;
  netProfitPerUnit: number;
  totalProfit: number;
  capitalPerUnit: number;
  totalCapital: number;
  marginPct: number;
  roiPct: number;
  isProfitable: boolean;
  volumeKg: number;
}

export interface CityOption {
  kode: string;
  name: string;
  province: string;
}

export interface CommodityOption {
  id: string;
  name: string;
  unit: string;
}
