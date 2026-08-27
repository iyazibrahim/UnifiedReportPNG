# Penang Unified Public Report

**One Telegram channel for public complaints across Pulau Pinang.**

People in Penang often do not know which office to call — city council, water company, roads, or state. This project gives them one place to report a problem: send a message on Telegram with a short description, optional photos, and a location. The system sorts the report and sends it to the right agency. Staff can follow cases on a simple web dashboard, and each agency has a demo inbox to update status (received, in progress, done, or rejected). The reporter gets updates back on Telegram.

## Technology

| Area | What we use |
|------|-------------|
| Bot chat | Telegram (Bot API) |
| Server | Node.js, Express |
| Website | React, Tailwind CSS |
| Database | MongoDB |
| Place names & maps | OpenStreetMap / Nominatim |
| Smart text help (optional) | OpenRouter (AI models) |
| Run locally / deploy | Docker Compose |

## End-user manual

### For the public (Telegram)

1. Open the Penang report bot in Telegram.
2. Tap **Start** or type `/start`. You will see a menu:
   - **Aduan Baharu** — make a new report  
   - **Semak Aduan** — check your recent reports  
   - **Bantuan** — short how-to  
3. Tap **Aduan Baharu**.
4. Type what is wrong **or** send a photo with a short caption.  
   Examples: *jalan berlubang di hadapan 7-Eleven Komtar*, *sampah bertimbun*, *paip bocor*.
5. Add more photos if you want (up to 5), then tap **Teruskan**, or **Tiada foto** if you have none.
6. Share your location:
   - Tap **Kongsi lokasi GPS**, or  
   - Type a nearby place (for example *Masjid Jamek Sungai Rusa* or *Lotus Kepala Batas*).
7. Check the pin on the map. Tap **Ya** if it is correct, or try again / go back to the menu.
8. Review the summary (category and suggested agency), then tap **Hantar aduan**.
9. Keep your reference number. You will get a Telegram message when the status changes.
10. Use **Semak Aduan** anytime to see your latest reports.

**Tips**

- Reports must be **in or near Penang** (a small border area is allowed). Faraway pins are rejected.
- If the chat looks empty after you clear history, type `/start` or open the **Menu** button beside the message box.
- You can also type `/status` or `/help`.

### For operations staff (admin website)

1. Open the admin site (example: `http://localhost:3500/admin`).
2. Sign in with the ops username and password.
3. **Overview** — see counts and recent reports.
4. **Cases** — search and filter all reports; open one for full detail, map, and photos.
5. **Mock portals** — pick an agency (Pearl, Aspire, MyJalan, PBAPP, ePINTAS) to open its demo inbox.
6. **Settings** — turn features on/off and update keys (Telegram token, optional AI key) without rebuilding the app.

New reports can show a short live alert on the admin screen.

### For agency demo users (mock portals)

1. From **Mock portals**, choose your agency, or open a link such as `/mock/pearl_mbpp`.
2. Open a ticket in the inbox.
3. Update status: **Diterima → Dalam tindakan → Selesai** or **Ditolak**.
4. The citizen who sent the report gets a Telegram update when you change the status.

These portals are **simulations** until real agency systems are connected.

---

## Getting it running (operators)

```bash
git clone https://github.com/iyazibrahim/UnifiedReportPNG.git
cd UnifiedReportPNG
cp .env.example .env
```

Set at least: Telegram bot token, ops password, and a secure login secret (`JWT_SECRET`).

```bash
docker compose up -d --build
docker compose exec app npm run seed:landmarks:file
```

Then open:

- Admin: http://localhost:3500/admin  
- Health check: http://localhost:3500/health  

Load place names into the database with the seed command above after each deploy if the landmark list changed.

## Tests

```bash
npm test
npm run build:dashboard
```

## License

Private / project use unless otherwise stated by the repository owner.
