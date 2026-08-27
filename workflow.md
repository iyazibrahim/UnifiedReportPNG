# Unified Report Penang — workflow

## Status

Admin dashboard + agency portals on a multi-channel intake platform (Telegram + WhatsApp scaffolding).

## Completed

- [x] Telegram intake, location truth/confirm/label, jurisdiction, agency adapters
- [x] Settings model (toggles + config + encrypted secrets); DB overrides env
- [x] Admin API: login JWT, cases, stats, settings
- [x] Agency portal API: inbox, detail, status workflow
- [x] Feature toggles wired into bot, classifier, geocode, gateway
- [x] React dashboard (`dashboard/`): admin + per-agency portals
- [x] Express serves `dashboard/dist`; `/ops` → `/admin`
- [x] Fix photo+caption session loop (Mongoose Mixed `draft` now markModified via `saveSession`)
- [x] Case detail UX: back button, OSM map, photo proxy/thumbnails, clearer lokasi wording
- [x] Formal BM bot copy + status-update notify template
- [x] Agency portals: Dashboard/Inbox nav; notify reporter on status PATCH
- [x] Overview: KPI cards, category/status donuts, animated agency flow; stats API extended
- [x] Photo without caption: keep image, ask plain-text description (`awaiting_description`) instead of forcing caption
- [x] Fix ticket ID reuse (PEARL-0001 after restart) that made new cases inherit old "Selesai" status
- [x] Cleanup script `scripts/fix-duplicate-tickets.js` to relink old shared PEARL-0001 tickets
- [x] Admin SSE live toasts (Lihat laporan, 10s) on new cases
- [x] Landmark text → LLM normalize → Nominatim pin + Ya / Cuba semula / Tidak pasti (triage)
- [x] Case detail labels: Pin GPS · Disahkan oleh pelapor · Nama jalan laporan
- [x] Abuse guards: rate limits, cooldown, burst soft-drop (`abuseGuardsEnabled`)
- [x] Admin UI: Stat Cards, Cases table+pagination, Overview side-by-side, photo carousel, sonner/Alert
- [x] Bot multi-photo: max 5, Teruskan / album debounce
- [x] Agency portals hub: bento picker with official agency logos (`/admin/portals`)
- [x] Bot main menu: Aduan Baharu / Semak Aduan / Bantuan; GPS keyboard only on location step
- [x] Landmark geocode: strip relative phrases (depan/berdekatan/traffic light) and retry Nominatim queries
- [x] Penang landmark DB (curated + OSM/Google seed); fuzzy match before Nominatim; 5 daerah labels
- [x] Landmark seed expanded (~1400+ OSM places: masjid/school/hospital/supermarket/mall)
- [x] Worship categories fixed: `place_of_worship` classified by OSM religion/name (masjid, temple, church, shrine, gurdwara, place_of_worship) — seed reclassified
- [x] Location boundary: allow ~3 km buffer, reject farther pins (GPS + typed)
- [x] Admin shell: fixed sidebar, Log out pinned at footer, only main content scrolls
- [x] Production wording: remove MVP/mock/demo/simulasi from user-facing copy
- [x] Multi-channel identity + shared intake engine + WhatsApp Cloud API adapter

## How to run

```bash
cp .env.example .env   # set channel credentials, OPS_PASSWORD, JWT_SECRET
docker compose up -d --build
# Seed landmark DB (curated file; optional OSM + Google Places)
npm run seed:landmarks:file
# Refresh seed from Overpass/Nominatim (writes data/landmarks.seed.json)
npm run seed:landmarks:expand
# Or full Mongo seed: GOOGLE_PLACES_API_KEY=... npm run seed:landmarks
```

- Admin: http://localhost:3500/admin
- Agency portal: http://localhost:3500/portals/pearl_mbpp (alias: `/mock/pearl_mbpp`)

Compose: `mongo` + `app` (dashboard baked into image via Dockerfile).

Landmark resolve order: local Mongo DB → LLM/Nominatim. No admin CRUD — refresh with seed script only.

Location scope: inside Pulau/Seberang or within 3 km of boundary; farther pins rejected in bot.

## Validation

- `npm test` — unit tests including landmark DB / daerah / boundary / WhatsApp webhook
- `npm run build:dashboard` — Vite production build OK

## Landmark coordinate fixes (2026-08-27)

- Design Village Penang was wrongly pinned at Bertam / Kepala Batas (`spu`, 5.5245, 100.442). Official site + Nominatim confirm Bandar Cassia / Batu Kawan (`sps`, 5.2436662, 100.4364736). Aliases updated (batu kawan / bandar cassia); misleading bertam-only aliases removed.
- Spot-check: Lotus's Kepala Batas remains correct in Bertam (`spu`). Entopia daerah/address corrected to Teluk Bahang / `barat_daya` (coords OK; label was wrong).
- `locateDaerah(5.2436662, 100.4364736)` → `sps`.

## Admin layout (2026-08-27)

- Sidebar is viewport-height and no longer scrolls with the page.
- Log out stays pinned at the sidebar footer (desktop); compact header button on mobile.
- Only the main content pane scrolls.

## WhatsApp + multi-channel (2026-08-27)

- Channel-neutral sessions/cases (`channel` + `channelUserId`)
- Shared intake FSM used by Telegram and WhatsApp adapters
- WhatsApp Cloud API: Settings credentials → webhook verify + inbound messages + status notify
- Durable photo storage under `data/media/` for WhatsApp (and optional Telegram download)
- User-facing copy no longer says MVP / mock / simulasi
