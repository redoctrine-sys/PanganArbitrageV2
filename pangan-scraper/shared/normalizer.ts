import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScrapedPrice } from "./types";

const SYSTEM_PROMPT = `You are a price data extraction agent for Indonesian commodity markets.

Input: HTML table or text from a price-listing source.
Output: STRICT JSON array of price records. No prose, no markdown, no code fences.

Each record:
{
  "city_raw": string,         // city/region name as shown
  "commodity_raw": string,    // commodity name as shown
  "price": number,            // FULL Rupiah value (e.g. 35000, NOT 35)
  "unit": "kg",               // ALWAYS normalize to per-kg
  "date": string,             // YYYY-MM-DD; if missing, use today
  "market_name": string|null, // pasar/market name if available
  "original_price": number,   // raw number before normalization
  "original_unit": string,    // raw unit text (e.g. "kg", "100g", "pack")
  "confidence": number        // 0-1 your confidence in normalization
}

Normalization rules:
- "35.000" or "35,000" → 35000
- "35rb" → 35000
- prices per 100g → multiply by 10 to get per-kg
- prices per pack/ikat → keep but flag confidence < 0.7
- if price unclear or missing → SKIP that row (do NOT invent)

Return ONLY the JSON array. Empty array [] if no valid rows found.`;

export async function extractPricesFromHtml(
  html: string,
  context: { source: ScrapedPrice["source"]; date: string; provinceHint?: string }
): Promise<ScrapedPrice[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
  });

  const prompt = [
    `Source: ${context.source}`,
    `Reference date: ${context.date}`,
    context.provinceHint ? `Province context: ${context.provinceHint}` : "",
    "",
    "Extract all price rows from this HTML:",
    "```html",
    html.slice(0, 60000),
    "```",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if Gemini added them despite instruction
  const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON: ${(err as Error).message}\nRaw: ${text.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) throw new Error("Gemini response is not an array");

  return parsed
    .map((row: unknown): ScrapedPrice | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const price = Number(r.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const cityRaw = String(r.city_raw ?? "").trim();
      const commodityRaw = String(r.commodity_raw ?? "").trim();
      if (!cityRaw || !commodityRaw) return null;
      return {
        source: context.source,
        city_raw: cityRaw,
        commodity_raw: commodityRaw,
        price,
        unit: "kg",
        date: String(r.date ?? context.date),
        market_name: r.market_name ? String(r.market_name) : undefined,
        original_price: r.original_price != null ? Number(r.original_price) : undefined,
        original_unit: r.original_unit ? String(r.original_unit) : undefined,
        confidence: Number(r.confidence ?? 0.7),
      };
    })
    .filter((p): p is ScrapedPrice => p !== null);
}
