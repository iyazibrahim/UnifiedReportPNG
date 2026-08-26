# Unified Report Penang

Telegram MVP for a **unified citizen reporting channel** in Pulau Pinang. Citizens report issues (text, photo, confirmed location) through chat — no new mobile or web app. The system classifies the issue, explains **which agency owns it**, and dispatches through mock adapters that can later swap to live Pearl (MBPP), Aspire (MBSP), MyJalan, PBAPP, and ePINTAS APIs.

WhatsApp is the intended production channel for Penang users; Telegram is used for this MVP because it is faster to ship and prove the pipeline.

## Why this exists

Penang currently has multiple reporting apps (Pearl / MBPP on the island, Aspire / MBSP on the mainland, state ePINTAS, MyJalan for roads, PBAPP for water). Citizens often do not know **who owns what**. This project is a single intake channel that:

1. Collects a complete report (description, optional photo, confirmed pin)
2. Classifies the category (LLM + keyword fallback)
3. Routes by **rules + geography** (not by guessing from street names alone)
4. Stores a stable case payload ready for real agency APIs

## Architecture

```text
Citizen (Telegram)
  → Intake session
  → Reverse geocode (label only)
  → LLM / keywords (category)
  → JurisdictionResolver (polygons + rules)
  → Case store
  → Agency gateway → mock Pearl / Aspire / MyJalan / PBAPP / ePINTAS
  → Ops case list
```

**Designed to expand without redesign:**

| Swap later | Keep the same |
|------------|----------------|
| WhatsApp Business API | Channel adapter shape |
| SPAJa / road asset GIS | `JurisdictionResolver` interface |
| Live agency HTTP APIs | `AgencyAdapter.submit(case)` |

## Location model (truth / confirm / label)

Coordinates are the source of truth. Reverse-geocoded street names are display helpers only (they often snap to a nearby major road).

| Field | Role |
|-------|------|
| **Truth** | `lat`, `lng`, `accuracy_m`, `source` — never overwritten by geocoding |
| **Confirm** | User must press **Betul** before dispatch |
| **Label** | Nominatim `display_name` / `road` + optional landmark |

Coarse live GPS (`accuracy_m > 80`) asks the user to **choose a point on the map** instead.

## Jurisdiction (who owns what)

Category comes from LLM/keywords. Agency comes from rules:

- Island pin → Pearl / MBPP for local council matters
- Mainland pin → Aspire / MBSP for local council matters
- Water → PBAPP
- Traffic lights / signs → MyJalan
- Local roads / street lights → prefer PBT; major-road name hints → MyJalan
- Flood / unclear / outside polygons → ePINTAS triage

Every case stores a Malay **reason** string so stakeholders can see why that agency was chosen.

## Stack

- Node.js 20+ (ES modules)
- Express
- MongoDB + Mongoose
- [grammY](https://grammy.dev/) (Telegram bot)
- OpenRouter (optional LLM intent)
- OpenStreetMap Nominatim (reverse geocode label)
- Docker Compose (local MongoDB)

## Project layout

```text
src/
  adapters/       Mock agency gateway + persistence
  bot/            Telegram conversation flow
  cases/          Case refs, payload, save
  classify/       Keywords + OpenRouter LLM
  jurisdiction/   Categories, polygons, resolver
  location/       Truth / confirm / label + Nominatim
  models/         Case, Session, MockTicket
  ops/            Basic-auth ops HTML table
  app.js          Express app
  index.js        Entrypoint
data/
  penang-regions.geojson
tests/
```

## Prerequisites

- Node.js 20+
- Docker (for MongoDB), or any MongoDB 7 instance
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Setup

```bash
git clone https://github.com/iyazibrahim/UnifiedReportPNG.git
cd UnifiedReportPNG

cp .env.example .env
# Edit .env — at least TELEGRAM_BOT_TOKEN

docker compose up -d
npm install
npm start
```

Open a chat with your bot and send `/start`.

### Environment

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Required |
| `MONGODB_URI` | Default `mongodb://127.0.0.1:27017/unified-report-penang` |
| `PORT` | Default `3000` |
| `TELEGRAM_WEBHOOK_URL` | If set, uses webhook; otherwise long polling |
| `TELEGRAM_WEBHOOK_SECRET` | Optional webhook secret |
| `OPENROUTER_API_KEY` | Optional; falls back to keywords |
| `OPENROUTER_MODEL` | Default `openai/gpt-4o-mini` |
| `OPS_USER` / `OPS_PASSWORD` | Basic auth for `/ops` |

## Citizen flow (Telegram)

1. `/start` — intro (BM)
2. Send issue description (and optional photo; can skip photo)
3. Share GPS or **choose location on the map**
4. Confirm pin: **Betul** / **Bukan** / **Betul + landmark**
5. Preview: category, agency, reason → **Hantar**
6. Receive reference `PG-YYYYMMDD-XXXX` and mock agency ticket id
7. `/status` or `/status PG-…` — look up own cases

## Ops view

Stakeholder proof page (not a citizen app):

```text
http://localhost:3000/ops
```

Basic auth uses `OPS_USER` / `OPS_PASSWORD`. Shows case list, agency reason, Google Maps link, and dispatch JSON payload.

Health check: `GET /health`

## Tests

```bash
npm test
```

Covers region polygons, jurisdiction routing, location truth/confirm/label, classification, adapters, ops HTML, and health.

## Production webhook (optional)

1. Expose HTTPS to the server
2. Set `TELEGRAM_WEBHOOK_URL=https://your-host/telegram/webhook`
3. Optionally set `TELEGRAM_WEBHOOK_SECRET`
4. Restart — the app registers the webhook with Telegram

## Out of scope (MVP)

- WhatsApp Business Solution Provider (BSP)
- Live Pearl / Aspire / MyJalan / PBAPP / ePINTAS APIs
- SPAJa road-ownership GIS
- MyKad verification
- Citizen web or native app
- Full operator ticketing workflow
- Snap-to-road geocoding (intentionally avoided)

## License

Private / project use unless otherwise stated by the repository owner.
