# Unified Report Penang — workflow

## Status

Telegram MVP implemented: intake bot, confirmed location (truth/confirm/label), jurisdiction rules, mock agency adapters, ops case list.

## Decisions

- Citizen channel: Telegram now, WhatsApp later (same channel shape).
- Location: truth (coords) / confirm (user lock) / label (Nominatim) are separate fields.
- Jurisdiction: LLM/keywords classify category only; rules + island/mainland polygons decide agency.
- Agency APIs: mock adapters now; real HTTP later behind the same interface.
- Stack: Node.js + Express + MongoDB + grammY + OpenRouter (optional) + Nominatim.

## Progress

- [x] Scaffold app, env, Telegram webhook/polling
- [x] Location truth/confirm/label
- [x] GeoJSON polygons + JurisdictionResolver
- [x] Bot intake + LLM/keyword classify
- [x] Mock adapters + ops case list

## How to run

1. `docker compose up -d` (MongoDB)
2. Copy `.env.example` → `.env` and set `TELEGRAM_BOT_TOKEN` (optional `OPENROUTER_API_KEY`)
3. `npm install` then `npm start`
4. Talk to the bot: description → photo (optional) → location → confirm → Hantar
5. Ops: `http://localhost:3000/ops` (basic auth from `.env`)

Without `TELEGRAM_WEBHOOK_URL`, the bot uses long polling. For production, set webhook URL to `https://your-host/telegram/webhook`.

## Validation

- `npm test` — unit tests for region, resolver, location, classify, adapters, ops, health
