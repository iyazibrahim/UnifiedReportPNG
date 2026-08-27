# Unified Report Penang

Telegram MVP for a **unified citizen reporting channel** in Pulau Pinang. Citizens report via chat (no new citizen app). The system classifies issues, routes to the right agency, and proves delivery through **mock agency portals**. Operators use a **shadcn-style admin dashboard** to monitor cases and edit runtime settings (API keys, env overrides, feature toggles).

## Architecture

```text
Citizen (Telegram)
  → Intake + confirmed GPS (truth/confirm/label)
  → LLM / keywords (category)
  → JurisdictionResolver (polygons + rules)
  → Case store + mock agency ticket
  → Admin dashboard  |  Mock Pearl / Aspire / MyJalan / PBAPP / ePINTAS portals
```

Runtime config: **dashboard Settings overrides `.env`**. Bootstrap-only secrets stay in env (`OPS_USER`, `OPS_PASSWORD`, `JWT_SECRET`, `MONGODB_URI`, `PORT`).

## Setup

```bash
git clone https://github.com/iyazibrahim/UnifiedReportPNG.git
cd UnifiedReportPNG

cp .env.example .env
# Set TELEGRAM_BOT_TOKEN, OPS_PASSWORD, JWT_SECRET
```

### Docker (recommended)

Builds the Express API + dashboard and runs MongoDB:

```bash
docker compose up -d --build
```

- Admin: http://localhost:3500/admin  
- Mock Pearl: http://localhost:3500/mock/pearl_mbpp  
- Health: http://localhost:3500/health  

Compose services: `mongo` + `app` (dashboard is baked into the app image).

### Local (without Docker app)

```bash
docker compose up -d mongo
npm install
cd dashboard && npm install && cd ..
npm run build:dashboard
npm start
```

Open a chat with your bot and send `/start`.

## Admin dashboard

| Route | Purpose |
|-------|---------|
| `/admin/login` | JWT login |
| `/admin` | Stats + recent cases |
| `/admin/cases` | Filterable case table |
| `/admin/cases/:ref` | Detail + link to mock portal |
| `/admin/settings` | Features / Configuration / API keys |

Settings tabs:

1. **Features** — enable/disable bot, LLM, Nominatim, mock dispatch, per-agency routing  
2. **Configuration** — OpenRouter model, webhook URL, Nominatim UA, mock portal PIN  
3. **API keys** — Telegram token, OpenRouter key, future agency keys (masked; dashboard overrides env)

## Mock agency portals

Mobile-first inboxes that receive dispatched tickets:

| Portal | URL |
|--------|-----|
| Pearl (MBPP) | `/mock/pearl_mbpp` |
| Aspire (MBSP) | `/mock/aspire_mbsp` |
| MyJalan | `/mock/myjalan` |
| PBAPP | `/mock/pbapp` |
| ePINTAS | `/mock/epintas` |

Status workflow: **Diterima → Dalam tindakan → Selesai / Ditolak**. Updates appear on the linked admin case detail.

## Citizen flow (Telegram)

1. `/start`  
2. Description (+ optional photo)  
3. Share or choose location → confirm pin  
4. Preview category/agency/reason → **Hantar**  
5. Receive `PG-…` + mock ticket id  
6. `/status` to look up cases  

## Environment

| Variable | Editable in dashboard? |
|----------|------------------------|
| `TELEGRAM_BOT_TOKEN` | Yes (API keys tab) |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Yes |
| `TELEGRAM_WEBHOOK_URL` / secret | Yes |
| `NOMINATIM_USER_AGENT` | Yes |
| `MOCK_PORTAL_PIN` | Yes |
| `OPS_USER` / `OPS_PASSWORD` | No (login only) |
| `JWT_SECRET` / `SETTINGS_ENCRYPTION_KEY` | No |
| `MONGODB_URI` / `PORT` | No |

## Project layout

```text
src/            Express API, bot, settings, adapters
dashboard/      React + Tailwind admin & mock portals
data/           Penang region polygons
tests/
```

## Tests

```bash
npm test
npm run build:dashboard
```

## Out of scope

- Live Pearl/Aspire/MyJalan APIs, WhatsApp BSP, SPAJa GIS, MyKad, native apps

## License

Private / project use unless otherwise stated by the repository owner.
