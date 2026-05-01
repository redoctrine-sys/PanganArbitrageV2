// @domain: arbitrage-agent
// @feature: gemini-layer2

import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROFIT_SCOUT_SYSTEM, buildAnalysisPrompt } from "./prompts";
import type { AnomalyAlert, ArbitrageOpportunity, GeminiAnalysis } from "./types";

const FALLBACK: GeminiAnalysis = {
  insights: [],
  recommended_actions: [],
  risk_factors: [],
  ai_signal: "TUNGGU",
  ai_confidence: 0,
};

/**
 * Layer 2: Gemini Flash analysis.
 * Graceful fallback if API key missing or Gemini returns error.
 */
export async function analyzeWithGemini(
  anomalies: AnomalyAlert[],
  opportunities: ArbitrageOpportunity[]
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Profit Scout] GEMINI_API_KEY not set — skipping Layer 2");
    return FALLBACK;
  }

  if (anomalies.length === 0 && opportunities.length === 0) {
    return { ...FALLBACK, insights: ["Tidak ada anomali atau peluang arbitrase terdeteksi saat ini."] };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: PROFIT_SCOUT_SYSTEM,
    });

    const prompt = buildAnalysisPrompt(anomalies, opportunities);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonText) as GeminiAnalysis;

    // Validate required fields
    if (!parsed.ai_signal || !Array.isArray(parsed.insights)) {
      throw new Error("Invalid Gemini response shape");
    }

    return {
      insights: parsed.insights ?? [],
      recommended_actions: parsed.recommended_actions ?? [],
      risk_factors: parsed.risk_factors ?? [],
      ai_signal: parsed.ai_signal ?? "TUNGGU",
      ai_confidence: parsed.ai_confidence ?? 0.5,
    };
  } catch (err) {
    console.error("[Profit Scout] Gemini error:", err);
    return { ...FALLBACK, insights: ["AI analysis tidak tersedia saat ini. Gunakan data statistik di atas."] };
  }
}
