export default function RouteMakerPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-[18px] pt-3 pb-3 bg-[#f0ece4] border-b-2 border-rule shrink-0">
        <div className="flex items-center gap-[9px]">
          <div className="w-1 h-[22px] rounded-[3px] bg-[#0ea5e9] shrink-0" />
          <div>
            <div className="font-serif text-[15px] font-bold">Route Maker</div>
            <div className="font-mono text-[10px] text-ink-dim">
              Fitur untuk mengatur dan mensimulasikan jalur transportasi logistik.
            </div>
          </div>
          <span className="ml-2 font-mono text-[9px] bg-[#e0f2fe] text-[#0369a1] px-[6px] py-px rounded-[4px]">
            Beta
          </span>
        </div>
      </div>

      {/* Placeholder body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <div className="text-[40px]">🗺</div>
        <div className="font-serif text-[16px] font-bold text-ink">Route Maker</div>
        <div className="font-mono text-[11px] text-ink-dim max-w-[320px] leading-[1.7]">
          Simulasikan dan optimalkan jalur transportasi logistik antar kota.
          Fitur ini sedang dalam pengembangan.
        </div>
        <div className="mt-2 px-4 py-[6px] bg-[#e0f2fe] text-[#0369a1] font-mono text-[10px] rounded-[6px] border border-[#bae6fd]">
          Coming Soon · Phase 3
        </div>
      </div>
    </div>
  );
}
