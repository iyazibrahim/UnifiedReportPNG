# Unified Report Penang — workflow

## Status

Admin dashboard + mock agency portals implemented on top of the Telegram MVP.

## Completed

- [x] Telegram MVP intake, location truth/confirm/label, jurisdiction, mock adapters
- [x] Settings model (toggles + config + encrypted secrets); DB overrides env
- [x] Admin API: login JWT, cases, stats, settings
- [x] Mock agency API: inbox, detail, status workflow
- [x] Feature toggles wired into bot, classifier, geocode, gateway
- [x] React dashboard (`dashboard/`): admin + per-agency mock portals
- [x] Express serves `dashboard/dist`; `/ops` → `/admin`
- [x] Fix photo+caption session loop (Mongoose Mixed `draft` now markModified via `saveSession`)
- [x] Case detail UX: back button, OSM map, photo proxy/thumbnails, clearer lokasi wording
- [x] Formal BM Telegram bot copy + status-update notify template
- [x] Mock portals: Dashboard/Inbox nav; Telegram notify reporter on status PATCH
- [x] Overview: KPI cards, category/status donuts, animated agency flow; stats API extended

## How to run

```bash
cp .env.example .env   # set TELEGRAM_BOT_TOKEN, OPS_PASSWORD, JWT_SECRET
docker compose up -d --build
```

- Admin: http://localhost:3500/admin
- Mock: http://localhost:3500/mock/pearl_mbpp

Compose: `mongo` + `app` (dashboard baked into image via Dockerfile).

## Validation

- `npm test` — 48 tests passing
- `npm run build:dashboard` — Vite production build OK
