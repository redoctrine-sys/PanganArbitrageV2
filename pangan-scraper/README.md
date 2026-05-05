# pangan-scraper

Multi-source commodity price scraper for **PanganArbitrage V2**. Sibling repo to `commodity-dashboard/`. Writes to shared Supabase `prices_raw` table via `source` field.

## Agents

| Agent | Source | Schedule | Status |
|-------|--------|----------|--------|
| **PIHPS** | bi.go.id/hargapangan | 4×/day | ✅ Live |
| Paskomnas | paskomnas.id | 1×/day | 🔲 Planned |
| Facebook | Chrome Extension | passive | 🔲 Planned |

## Setup

```bash
npm install
npm run install-browsers          # Playwright chromium
cp .env.example .env              # Fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
```

## Run PIHPS

```bash
npm run scrape:pihps              # Production run
npm run scrape:pihps:debug        # Verbose + saves debug HTML
```

## Stack

- **Playwright** — JS-rendered table extraction
- **Gemini Flash** — table → structured JSON normalization
- **Supabase** — service role write to `prices_raw`

All scrapers log to `scrape_runs` table. Inserts into `prices_raw` use `source` field for routing — same table as SP2KP, dashboard filters by source.
