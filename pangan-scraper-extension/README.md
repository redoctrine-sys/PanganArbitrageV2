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

## Setup

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder
4. Click extension icon → enter your **Gemini API key** and **API URL**
5. Toggle keyword presets (BUMBU, POKOK, PROTEIN, SAYUR, BUAH)
6. Add any custom keywords (not limited to 17 SP2KP commodities)

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
├── icons/              — Extension icons (16, 48, 128px)
└── README.md           — This file
```

## Icons

You need to add icon files to the `icons/` folder:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

Use a grain/wheat emoji or green leaf theme to match PanganArbitrage branding.

## Requirements

- Chrome 88+ (Manifest V3 support)
- Gemini API key (free tier)
- PanganArbitrage V2 API URL (for pushing accepted prices)
