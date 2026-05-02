"use client";

import { fmtRp } from "@/components/arbitrase/arbitrase.types";
import type { TransportOption } from "./alert-card.types";
import { fmtEta } from "./alert-card.utils";

function WeightLossDetail({ opt, priceSell }: { opt: TransportOption; priceSell: number }) {
  const shrinkVal = (opt.weight_loss_pct! / 100) * opt.capacity_kg * priceSell;
  const adjProfit = opt.profit - shrinkVal;
  return (
    <>
      <div className="flex justify-between border-t border-rule mt-[2px] pt-[3px]">
        <span className="text-ink-dim">Susut Bobot ({opt.weight_loss_pct!.toFixed(1)}%)</span>
        <span className="text-dn">− {fmtRp(shrinkVal)}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span className="text-ink-mid">Net Setelah Susut</span>
        <span className={adjProfit >= 0 ? "text-up" : "text-dn"}>{fmtRp(adjProfit)}</span>
      </div>
    </>
  );
}

export function TransportOptionsAccordion({
  options,
  distanceKm,
  defaultEtaHours,
  priceSell,
}: {
  options: TransportOption[];
  distanceKm?: number;
  defaultEtaHours?: number;
  priceSell?: number;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mt-[6px] mb-[4px] flex flex-col gap-[3px]">
      {options.map((opt, idx) => (
        <details
          key={idx}
          className="text-[10px] rounded border border-rule overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <summary className="cursor-pointer font-mono px-2 py-[4px] bg-paper-2 hover:bg-rule select-none flex items-center gap-1">
            <span className="text-ink-dim shrink-0">Opsi {idx + 1}:</span>
            <span className="font-semibold text-ink flex-1">{opt.vendor_name} ({opt.capacity_kg.toLocaleString()}kg)</span>
            <span className="text-ink shrink-0">{fmtRp(opt.cost)}</span>
            <span className={`shrink-0 ml-1 font-bold ${opt.roi >= 0 ? "text-up" : "text-dn"}`}>
              {opt.roi.toFixed(1)}% ROI
            </span>
          </summary>
          <div className="px-3 py-[6px] bg-white font-mono flex flex-col gap-[3px]">
            <div className="text-ink-dim">{opt.breakdown}</div>
            <div className="flex justify-between pt-[3px] border-t border-rule mt-[2px]">
              <span className="text-ink-mid">Estimasi Perjalanan</span>
              <span className="font-semibold text-ink">
                {opt.eta_hours != null
                  ? fmtEta(opt.eta_hours, distanceKm)
                  : defaultEtaHours != null
                    ? fmtEta(defaultEtaHours, distanceKm)
                    : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-mid">Net Profit ({opt.capacity_kg.toLocaleString()} kg)</span>
              <span className={`font-semibold ${opt.profit >= 0 ? "text-up" : "text-dn"}`}>{fmtRp(opt.profit)}</span>
            </div>
            {opt.weight_loss_pct != null && priceSell != null && (
              <WeightLossDetail opt={opt} priceSell={priceSell} />
            )}
            <div className="flex justify-between">
              <span className="text-ink-mid">ROI</span>
              <span className={`font-semibold ${opt.roi >= 0 ? "text-up" : "text-dn"}`}>{opt.roi.toFixed(2)}%</span>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
