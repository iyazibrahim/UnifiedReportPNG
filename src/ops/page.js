import { toDispatchPayload } from "../cases/payload.js";

function unauthorized(res) {
  res.set("WWW-Authenticate", 'Basic realm="ops"');
  res.status(401).send("Unauthorized");
}

export function basicAuth(user, password) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const [scheme, encoded] = header.split(" ");
    if (scheme !== "Basic" || !encoded) return unauthorized(res);
    const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
    if (u !== user || p !== password) return unauthorized(res);
    next();
  };
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function renderOpsPage(cases) {
  const rows = cases
    .map((c) => {
      const loc = c.location || {};
      const map =
        loc.lat != null
          ? `<a href="${mapsUrl(loc.lat, loc.lng)}">peta</a>`
          : "-";
      const payload = JSON.stringify(toDispatchPayload(c), null, 2);
      return `<tr>
        <td>${c.ref}</td>
        <td>${c.classification?.categoryLabel || c.classification?.categoryId || ""}</td>
        <td>${c.jurisdiction?.agencyLabel || ""}</td>
        <td>${c.jurisdiction?.reason || ""}</td>
        <td>${map}</td>
        <td>${c.status}</td>
        <td>${c.dispatch?.externalRef || ""}</td>
        <td><pre>${payload.replace(/</g, "&lt;")}</pre></td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ms">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OnePenang Dashboard — Ops</title>
  <style>
    :root { font-family: "IBM Plex Sans", "Segoe UI", sans-serif; background: #eef3ef; color: #1c2b22; }
    body { margin: 0; }
    header { padding: 1.25rem 1.5rem; background: #1c4b3a; color: #f4f7f2; }
    header p { margin: 0.3rem 0 0; opacity: 0.85; font-size: 0.95rem; }
    h1 { margin: 0; font-size: 1.35rem; letter-spacing: 0.02em; }
    main { padding: 1rem; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #c5d2c8; padding: 0.55rem 0.65rem; vertical-align: top; font-size: 0.85rem; }
    th { background: #dce8df; text-align: left; }
    pre { margin: 0; max-width: 28rem; white-space: pre-wrap; font-size: 0.72rem; }
    a { color: #1c4b3a; }
  </style>
</head>
<body>
  <header>
    <h1>OnePenang Dashboard</h1>
    <p>Senarai kes — routing ke Pearl / Aspire / MyJalan / PBAPP / ePINTAS</p>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>Rujukan</th>
          <th>Kategori</th>
          <th>Agensi</th>
          <th>Kenapa</th>
          <th>Lokasi</th>
          <th>Status</th>
          <th>Tiket</th>
          <th>Payload</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="8">Tiada kes lagi.</td></tr>`}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}
