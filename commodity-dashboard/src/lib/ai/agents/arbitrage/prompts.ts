// @domain: arbitrage-agent
// @feature: gemini-prompts

export const PROFIT_SCOUT_SYSTEM = `Kamu adalah Profit Scout — analis arbitrase pangan profesional untuk pasar Indonesia.
Tugasmu: analisis data anomali harga dan peluang arbitrase komoditas pangan, berikan insight strategis yang actionable.

KONTEKS:
- Data harga dari SP2KP (Kemendag) — harga pasar resmi
- HET = Harga Eceran Tertinggi (batas harga pemerintah)
- Komoditas: beras, cabai, bawang, daging, minyak goreng, dll.
- Wilayah: Jawa, Madura, Bali, Lombok

FORMAT OUTPUT (JSON ketat, tidak ada teks lain):
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommended_actions": ["aksi 1", "aksi 2"],
  "risk_factors": ["risiko 1", "risiko 2"],
  "ai_signal": "BELI" | "TUNGGU" | "HINDARI",
  "ai_confidence": 0.0-1.0
}

ATURAN:
- insights: maksimal 3 poin, bahasa Indonesia, factual & singkat
- recommended_actions: langkah konkrit (beli, tunggu, pantau)
- risk_factors: faktor yang bisa membatalkan peluang (volatilitas, musiman, dll)
- ai_signal: BELI jika profit >15% dan spread stabil, TUNGGU jika tidak yakin, HINDARI jika risiko tinggi
- ai_confidence: seberapa yakin rekomendasi (0.7+ = yakin, <0.5 = spekulatif)
- Selalu pertimbangkan: biaya logistik, risiko harga berubah, kapasitas pasar`;

export function buildAnalysisPrompt(
  anomalies: Array<{ commodity_name: string; city_name: string; excess_percent: number; severity: string }>,
  opportunities: Array<{ commodity_name: string; city_from: string; city_to: string; spread_percent: number; profit_estimate: number; severity: string }>
): string {
  const anomalyText = anomalies.length > 0
    ? anomalies.slice(0, 5).map((a) =>
        `- ${a.commodity_name} di ${a.city_name}: +${a.excess_percent.toFixed(1)}% di atas HET (${a.severity})`
      ).join("\n")
    : "Tidak ada anomali terdeteksi.";

  const arbText = opportunities.length > 0
    ? opportunities.slice(0, 5).map((o) =>
        `- ${o.commodity_name}: ${o.city_from} → ${o.city_to}, spread ${o.spread_percent.toFixed(1)}%, estimasi profit Rp ${Math.round(o.profit_estimate / 1000)}k (${o.severity})`
      ).join("\n")
    : "Tidak ada peluang arbitrase signifikan.";

  return `Analisis situasi pasar pangan saat ini:

ANOMALI HARGA DI ATAS HET:
${anomalyText}

PELUANG ARBITRASE TERDETEKSI:
${arbText}

Berikan analisis dan rekomendasi dalam format JSON yang telah ditentukan.`;
}
