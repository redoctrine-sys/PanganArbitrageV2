"use client";

export function AIInsightsPanel({
  insights,
  recommendedActions,
  riskFactors,
}: {
  insights?: string[];
  recommendedActions?: string[];
  riskFactors?: string[];
}) {
  return (
    <>
      {insights && insights.length > 0 && (
        <div>
          <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">🤖 AI Insight</div>
          <div className="flex flex-col gap-[3px]">
            {insights.map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">· {s}</div>
            ))}
          </div>
        </div>
      )}
      {recommendedActions && recommendedActions.length > 0 && (
        <div>
          <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">📋 Rekomendasi</div>
          <div className="flex flex-col gap-[3px]">
            {recommendedActions.map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">→ {s}</div>
            ))}
          </div>
        </div>
      )}
      {riskFactors && riskFactors.length > 0 && (
        <div>
          <div className="font-mono text-[9px] font-bold text-ink-dim uppercase tracking-[0.7px] mb-[6px]">⚠ Risiko</div>
          <div className="flex flex-col gap-[3px]">
            {riskFactors.map((s, i) => (
              <div key={i} className="text-[10px] text-ink-mid leading-[1.5]">! {s}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
