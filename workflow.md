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
- [x] Photo without caption: keep image, ask plain-text description (`awaiting_description`) instead of forcing caption
- [x] Fix mock ticket ID reuse (PEARL-0001 after restart) that made new cases inherit old "Selesai" status
- [x] Cleanup script `scripts/fix-duplicate-tickets.js` to relink old shared PEARL-0001 tickets
- [x] Admin SSE live toasts (Lihat laporan, 10s) on new cases
- [x] Landmark text → LLM normalize → Nominatim pin + Ya / Cuba semula / Tidak pasti (triage)
- [x] Case detail labels: Pin GPS · Disahkan oleh pelapor · Nama jalan laporan
- [x] Abuse guards: rate limits, cooldown, burst soft-drop (`abuseGuardsEnabled`)
- [x] Admin UI: Stat Cards, Cases table+pagination, Overview side-by-side, photo carousel, sonner/Alert
- [x] Bot multi-photo: max 5, Teruskan / album debounce
- [x] Mock portals hub: bento picker with official agency logos (`/admin/mock-portals`)
- [x] Bot main menu: Aduan Baharu / Semak Aduan / Bantuan; GPS keyboard only on location step
- [x] Landmark geocode: strip relative phrases (depan/berdekatan/traffic light) and retry Nominatim queries
- [x] Penang landmark DB (curated + OSM/Google seed); fuzzy match before Nominatim; 5 daerah labels
- [x] Location boundary: allow ~3 km buffer, reject farther pins (GPS + typed)

## How to run

```bash
cp .env.example .env   # set TELEGRAM_BOT_TOKEN, OPS_PASSWORD, JWT_SECRET
docker compose up -d --build
# Seed landmark DB (curated file; optional OSM + Google Places)
npm run seed:landmarks:file
# Or full: GOOGLE_PLACES_API_KEY=... npm run seed:landmarks
```

- Admin: http://localhost:3500/admin
- Mock: http://localhost:3500/mock/pearl_mbpp

Compose: `mongo` + `app` (dashboard baked into image via Dockerfile).

Landmark resolve order: local Mongo DB → LLM/Nominatim. No admin CRUD — refresh with seed script only.

Location scope: inside Pulau/Seberang or within 3 km of boundary; farther pins rejected in bot.

## Validation

- `npm test` — unit tests including landmark DB / daerah / boundary
- `npm run build:dashboard` — Vite production build OK
