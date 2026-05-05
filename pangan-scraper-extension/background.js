// ===========================================================================
// PanganScraper — Background Service Worker
// Stage 2: Receives matched posts from content script → calls Gemini Flash
// Stage 3: Saves extracted prices to chrome.storage.local (pending status)
// ===========================================================================

importScripts('keywords.js', 'storage.js');

// ─── Message Handler ─────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'PROCESS_POST':
      handleProcessPost(message.data);
      break;

    case 'GET_KEYWORD_CONFIG':
      getKeywordConfig().then(config => sendResponse({ config }));
      return true; // async response

    case 'PUSH_TO_SUPABASE':
      handlePushToSupabase(message.data);
      return true;

    default:
      break;
  }
});

// ─── Startup ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[PanganScraper] Extension installed/updated');

  // Initialize defaults
  await getKeywordConfig();
  await chrome.storage.local.set({ extensionEnabled: true });
  await updateBadge();
});

// Daily cleanup alarm
chrome.alarms.create('cleanup', { periodInMinutes: 1440 }); // 24 hours
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    await cleanupOldCaptures();
    console.log('[PanganScraper] Old captures cleaned up');
  }
});

// ─── Stage 2: Gemini Flash Extraction ────────────────────────────────
/**
 * Process a matched Facebook post via Gemini Flash
 * @param {Object} postData - { text, url, matchedKeywords, matchedHints, timestamp }
 */
async function handleProcessPost(postData) {
  try {
    const settings = await chrome.storage.local.get('geminiApiKey');
    const apiKey = settings.geminiApiKey;

    if (!apiKey) {
      console.warn('[PanganScraper] No Gemini API key set. Skipping extraction.');
      return;
    }

    console.log(`[PanganScraper] Stage 2: Sending to Gemini Flash (${postData.text.length} chars)...`);

    const extracted = await callGeminiFlash(apiKey, postData.text);

    if (!extracted || extracted.length === 0) {
      console.log('[PanganScraper] Gemini returned no prices.');
      return;
    }

    // Stage 3: Save to local storage
    const config = await getKeywordConfig();

    for (const item of extracted) {
      // Auto-reject low confidence
      if (item.confidence < 0.6) {
        console.log(`[PanganScraper] Low confidence (${item.confidence}), skipping: ${item.commodity}`);
        continue;
      }

      // Price range validation
      const range = findPriceRange(item.commodity, config.priceRanges);
      if (item.price < range.min || item.price > range.max) {
        console.log(`[PanganScraper] Price out of range (${item.price} not in ${range.min}-${range.max}): ${item.commodity}`);
        continue;
      }

      // Save to local storage (status: "pending")
      await addCapture({
        commodity: item.commodity,
        price: item.price,
        unit: item.unit || 'kg',
        city: item.city || 'Unknown',
        confidence: item.confidence,
        sourceSnippet: postData.text.slice(0, 200),
        sourceUrl: postData.url || null,
        matchedKeywords: postData.matchedKeywords
      });
    }
  } catch (error) {
    console.error('[PanganScraper] Gemini extraction error:', error);
  }
}

// ─── Gemini Flash API Call ────────────────────────────────────────────
/**
 * Call Gemini Flash to extract commodity prices from post text
 * @param {string} apiKey - Gemini API key
 * @param {string} postText - Full Facebook post text
 * @returns {Promise<Array<{commodity: string, price: number, unit: string, city: string, confidence: number}>>}
 */
async function callGeminiFlash(apiKey, postText) {
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const prompt = `Kamu adalah ekstraktor harga komoditas pangan Indonesia.

Dari teks Facebook post berikut, ekstrak SEMUA harga komoditas yang disebutkan.

Teks post:
"""
${postText}
"""

Rules:
1. Hanya ekstrak harga komoditas pangan (bukan ongkir, bukan harga non-pangan)
2. Normalisasi harga ke Rupiah penuh (35rb = 35000, 35k = 35000)
3. Normalisasi unit ke "kg" jika memungkinkan. Jika tidak jelas, gunakan unit aslinya.
4. Ekstrak kota/lokasi jika disebutkan. Jika tidak ada, tulis "Unknown".
5. Beri confidence score 0.0-1.0 (1.0 = sangat yakin)

Output HANYA valid JSON array, tanpa penjelasan:
[
  {
    "commodity": "nama komoditas",
    "price": 35000,
    "unit": "kg",
    "city": "Surabaya",
    "confidence": 0.92
  }
]

Jika tidak ada harga komoditas pangan, output: []`;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('[PanganScraper] Failed to parse Gemini response:', text);
    return [];
  }
}

// ─── Push to Supabase (Stage 4 — user-triggered) ─────────────────────
/**
 * Push accepted captures to Supabase via the PanganArbitrage API
 * Called from popup.js when user clicks Accept
 * @param {Object} data - { captures: CapturedPrice[], apiUrl: string }
 */
async function handlePushToSupabase(data) {
  const { captures, apiUrl } = data;

  if (!apiUrl || !captures || captures.length === 0) {
    console.warn('[PanganScraper] No API URL or captures to push');
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/scraper/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'facebook',
        prices: captures.map(c => ({
          commodity_raw: c.commodity,
          price: c.price,
          unit: c.unit,
          city_raw: c.city,
          date: c.capturedAt.slice(0, 10),
          confidence: c.confidence,
          source_url: c.sourceUrl
        }))
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[PanganScraper] Supabase push failed: ${err}`);
      return;
    }

    const result = await response.json();
    console.log(`[PanganScraper] Pushed ${captures.length} prices to Supabase:`, result);
  } catch (error) {
    console.error('[PanganScraper] Push to Supabase error:', error);
  }
}

// ─── Utility ─────────────────────────────────────────────────────────
/**
 * Find the price range for a commodity
 * Uses fuzzy matching — checks if commodity name contains any range key
 */
function findPriceRange(commodity, priceRanges) {
  const lower = commodity.toLowerCase();
  for (const [key, range] of Object.entries(priceRanges)) {
    if (key === '_default') continue;
    if (lower.includes(key)) return range;
  }
  return priceRanges._default || { min: 1000, max: 500000 };
}
