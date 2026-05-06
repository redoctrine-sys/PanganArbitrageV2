# 🌾 PanganScraper — Chrome Extension

Passively captures commodity prices from Facebook groups for PanganArbitrage V2.

## How It Works

1. **Browse Facebook normally** — join pedagang/grosir groups
2. **Extension watches silently** — scans posts for commodity keywords
3. **AI extracts prices** — Gemini Flash parses matched posts
4. **You review & approve** — accept/edit/reject captured prices
5. **Push to Supabase** — only accepted prices go to production DB

## 4-Stage Pipeline

```
Stage 1: Keyword Trigger (local, $0)
  → MutationObserver scans posts for commodity keywords + context hints
  → Filters out ~85% noise before any AI call

Stage 2: Gemini Flash Extraction (~1 call/matched post)
  → Full post text → AI extracts { commodity, price, unit, city, confidence }
  → Handles multi-price posts in one call

Stage 3: Local Storage (chrome.storage.local)
  → Auto-reject confidence < 0.6
  → Dedup by (commodity + city + date)
  → Status: "pending" — badge shows count

Stage 4: User Review (popup)
  → Accept / Edit / Reject each capture
  → Only accepted items → POST /api/scraper/ingest → Supabase
```

## Running the Extension

### 1. Load extension into Chrome

1. Open Chrome → navigate to `chrome://extensions`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked** (top-left button)
4. Select folder: `D:\repo antigravity\PanganArbitrageV2\pangan-scraper-extension`
5. Extension appears in the list — "PanganScraper - Commodity Price Capture"

### 2. Pin extension (optional)

- Click puzzle icon 🧩 in Chrome toolbar → find "PanganScraper" → click pin 📌
- Extension icon appears in toolbar for quick access

### 3. Configure

1. Click extension icon → popup opens
2. **Gemini API key** — paste `AIzaSy...` (same key from `pangan-scraper/.env`)
3. **API URL** — `http://localhost:3000/api/scraper/ingest` (dev) or your Vercel URL (production)
4. **Keyword presets** — toggle relevant ones (BUMBU, POKOK, PROTEIN, SAYUR, BUAH)
5. **Custom keywords** — add specific terms if needed (e.g. "kurma", "madu")
6. Click **Save**

### 4. Browse Facebook

1. Open https://www.facebook.com
2. Log in (if not already)
3. Join target pedagang/grosir groups — examples:
   - "Pedagang Pasar Kramat Jati"
   - "Grosir Sayur Bandung"
   - "Pedagang Beras Surabaya"
4. Scroll feed normally
5. Extension auto-scans posts in background — **no manual action needed**

### 5. Review captures

- Red badge on extension icon = number of pending captures
- Click extension icon → **Review** tab
- Each entry shows: commodity, price, unit, city, confidence score
- Choose per item:
  - **Accept** ✓ — pushes to Supabase
  - **Edit** ✏ — fix fields then accept
  - **Reject** ✗ — discard
- Only accepted items POST to `/api/scraper/ingest` → `prices_raw` (source: "facebook")

### 6. Verify data in Supabase

```sql
SELECT date, city_raw, commodity_raw, price, created_at
FROM prices_raw
WHERE source = 'facebook'
ORDER BY created_at DESC
LIMIT 20;
```

### 7. Reload extension after code changes

After editing any `.js` or `manifest.json`:

1. Go to `chrome://extensions`
2. Find PanganScraper
3. Click the **🔄 reload** icon on the extension card
4. Refresh Facebook tab to re-inject content script

## Pre-requisite Checklist

| Requirement | Notes |
|-------------|-------|
| Gemini API key | Free tier OK (60 RPM). Same key as scraper repo. |
| Dashboard `/api/scraper/ingest` endpoint | Required to receive accepted captures. |
| Chrome 88+ | For Manifest V3 support. |
| Facebook account | Logged in, joined to target groups. |

## File Structure

```
pangan-scraper-extension/
├── manifest.json       — Chrome MV3 manifest
├── background.js       — Service worker: Gemini Flash calls + Supabase push
├── content-script.js   — Facebook feed scanner + keyword matcher
├── keywords.js         — Keyword config: presets, custom, negative, context
├── storage.js          — Local storage CRUD for CapturedPrice items
├── popup.html          — Extension popup UI
├── popup.js            — Popup logic: review queue, keywords, settings
├── icons/              — Extension icons (16, 48, 128 px)
└── README.md           — This file
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Badge stays at 0 after browsing | Check API key set, keyword presets enabled, browsing actual pedagang group (not personal feed) |
| "Failed to fetch" on Accept | API URL wrong or dashboard not running. Test with `curl http://localhost:3000/api/health` |
| Captures show but all confidence < 0.6 | Group posts may not contain commodity keywords. Add custom keywords matching your target group's vocabulary. |
| Extension icon greyed out | Reload extension on `chrome://extensions` — service worker may have stopped |
| Multiple duplicate captures | Dedup uses (commodity + city + date). If commodity name varies ("cabe" vs "cabai"), normalize via keyword aliases. |

## Requirements

- Chrome 88+ (Manifest V3 support)
- Gemini API key (free tier)
- PanganArbitrage V2 API URL (for pushing accepted prices)
