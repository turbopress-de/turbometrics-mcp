# wpperf-mcp — MCP Server für turbometrics.io

## Überblick
Node.js MCP-Server (Model Context Protocol) für turbometrics.io.
Stellt KI-Tools (Claude, ChatGPT etc.) bereit um turbometrics-Daten abzufragen und Aktionen auszuführen.
Läuft auf Port 3001, erreichbar über https://turbometrics.io/mcp

## Tech Stack
- Node.js 20 (Alpine Docker)
- @modelcontextprotocol/sdk (offizielles Anthropic SDK)
- Express (HTTP/SSE Transport)
- Docker

## Projektstruktur
src/
  index.js       — HTTP-Server, Port-Binding
  server.js      — MCP-Server, Tool-Registrierung, Auth
  api.js         — HTTP-Client für turbometrics REST API
  tools/         — Ein File pro Tool

## Lokale Entwicklung

### Voraussetzungen
- Node.js 20+
- Zugang zur turbometrics API (API-Token ab Starter-Plan)

### Setup
npm install
cp .env.example .env
# API_BASE_URL und PORT in .env setzen

### Starten
node src/index.js

### Testen mit MCP Inspector
npx @modelcontextprotocol/inspector node src/index.js

## Environment Variables
API_BASE_URL=https://turbometrics.io/api/v1
PORT=3001

## Tools
| Tool | Typ | Beschreibung |
|------|-----|--------------|
| list_domains | read | Alle überwachten Domains |
| get_latest_scan | read | Neuester Scan einer Domain |
| get_scan_history | read | Score-Verlauf (überwachte + neue Domains) |
| get_findings | read | Detaillierte Findings eines Scans |
| list_alerts | read | Offene/resolved Alerts |
| get_rum_summary | read | RUM Core Web Vitals Zusammenfassung |
| get_rum_metric_history | read | Tagesverlauf einer RUM-Metrik (LCP/CLS/INP/FCP/TTFB) |
| get_rum_pages | read | Langsamste Seiten je RUM-Metrik |
| compare_domains | read | Zwei Domains direkt vergleichen |
| trigger_scan | write | Sofortigen Scan starten (neue oder bestehende Domains, mit region/force/auth) |
| mark_alerts_read | write | Alerts als gelesen markieren |
| get_account_info | read | Account-Info: Plan, API-Limits, RUM-Status |

## Authentifizierung
Jeder MCP-Request muss einen Authorization: Bearer {api_token} Header mitschicken.
Der Token wird 1:1 an die turbometrics API weitergeleitet.
Kein separates Token-Management im MCP-Server.

## Tests

### Ausführen
npm test

### Test-Struktur
test/
  api.test.js        — HTTP-Client Tests (gemockte API)
  tools.test.js      — Tool-Handler Tests
  server.test.js     — MCP-Server Integration Tests

### Neues Tool testen
1. Unit Test in test/tools.test.js ergänzen
2. Mock für API-Response definieren
3. npm test ausführen

## Deployment

### Server: Hetzner DE (gleicher Server wie Laravel)
Pfad: /opt/wpperf-mcp
Port: 3001 (intern), erreichbar über https://turbometrics.io/mcp (Nginx Proxy)

### Docker

#### Build
docker build -t wpperf-mcp .

#### Run
docker run -d \
  --name wpperf-mcp \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env \
  wpperf-mcp

#### Logs
docker logs -f wpperf-mcp

#### Stop/Restart
docker stop wpperf-mcp
docker start wpperf-mcp
docker restart wpperf-mcp

### Git Deploy
Kein automatisches CI/CD — manuelles Deployment:

git pull
docker build -t wpperf-mcp .
docker stop wpperf-mcp
docker rm wpperf-mcp
docker run -d \
  --name wpperf-mcp \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env \
  wpperf-mcp

### Nach Code-Änderungen
Nur bei Änderungen an src/ oder package.json:
docker build -t wpperf-mcp . && docker compose up -d --force-recreate

**Nicht `docker restart`.** Der Befehl startet den *bestehenden* Container neu,
und der hängt an der Abbild-ID, mit der er erzeugt wurde — ein frisch gebautes
Abbild wird ignoriert. Der Bau läuft durch, der Neustart läuft durch, alles
sieht richtig aus, und der Server liefert weiter den alten Code. Nachgewiesen
am 2026-08-16 beim Ausrollen der englischen Werkzeugbeschreibungen. Kontrolle
im Zweifel: `docker inspect wpperf-mcp --format '{{.Image}}'` gegen
`docker images --no-trunc --format '{{.ID}}' wpperf-mcp` — die beiden müssen
gleich sein.

Nur .env geändert:
docker stop wpperf-mcp && docker rm wpperf-mcp && docker run -d --name wpperf-mcp --restart unless-stopped -p 127.0.0.1:3001:3001 --env-file .env wpperf-mcp

Achtung: docker-compose.yml hat kein `build:`, nur `image:`. `docker compose up -d --build`
baut daher **nicht** neu, sondern meldet nur "Running". Immer erst `docker build -t wpperf-mcp .`,
dann `docker compose up -d --force-recreate`.

Ebenso: `API_BASE_URL` in der `.env` auf dem Server überschreibt den Default im Code.
Bei einem Domain- oder Endpunktwechsel beide Stellen anfassen.

## MCP Registry

Der Server ist in der offiziellen Registry veröffentlicht als
`io.github.turbopress-de/turbometrics-mcp`. Die Namespace-Eigentümerschaft wird über
das GitHub-Repo `github.com/turbopress-de/turbometrics-mcp` geprüft — Änderungen an
`server.json` also **vor** dem Publish auf das `github`-Remote pushen, nicht nur auf
`origin`.

Ablauf für eine Aktualisierung:

1. Version anheben — in `server.json` **und** `package.json`. Die Registry versioniert
   unveränderlich und lehnt ein erneutes Publish derselben Version ab. Reine
   URL- oder Metadatenänderungen sind ein Patch-Sprung.
2. `git push origin master && git push github master`
3. `mcp-publisher login github` — GitHub-Device-Flow, zeigt Code und URL an und muss
   im Browser bestätigt werden. Der abgelegte Registry-Token läuft nach etwa einer
   Stunde ab, für ein Publish Wochen später ist der Login also immer wieder fällig.
4. `mcp-publisher publish`

Prüfen, was tatsächlich veröffentlicht ist:

    curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=turbometrics" | jq

Maßgeblich ist der Eintrag mit `isLatest: true`. Ältere Versionen bleiben mit ihrer
alten `remote.url` bestehen und lassen sich nicht zurückziehen — Clients auf einer
alten Version rufen also weiter die dort hinterlegte Adresse auf. Beim Domainwechsel
am 01.08.2026 war das der Grund, die alte Domain `/mcp` weiter ausliefern zu lassen,
statt sie umzuleiten: Bei einem Cross-Origin-Redirect verwerfen die meisten
HTTP-Clients den `Authorization`-Header, der Bearer-Token käme also nie an.

Die Token-Dateien `.mcpregistry_github_token` und `.mcpregistry_registry_token` landen
im Repo-Verzeichnis und sind in der `.gitignore` — nie einchecken.

## Claude Desktop Setup (Mac)

Config: ~/Library/Application Support/Claude/claude_desktop_config.json

```json
{
  "mcpServers": {
    "turbometrics": {
      "command": "/opt/homebrew/bin/npx",
      "args": [
        "mcp-remote",
        "https://turbometrics.io/mcp",
        "--header",
        "Authorization: Bearer DEIN_API_TOKEN"
      ]
    }
  }
}
```

Voraussetzung: Node.js via Homebrew installiert (`brew install node`)
npx-Pfad ggf. anpassen (`which npx`)

## Bekannte Eigenheiten

- `api.get()` gibt komplettes `response.json()` zurück inkl. `data`-Wrapper — in Tools immer `response.data` verwenden, nie `response` direkt
- RUM-Site-Lookup und Domain-Lookup: API gibt nur Hostnamen zurück (z.B. `turbopress.de`), User gibt `domain_url` mit Protokoll ein — immer `new URL(domain_url).hostname` für den Vergleich verwenden
- `GET /domains` und `GET /rum/sites` haben Pagination — immer alle Seiten laden via while-Loop
- `report_url` kommt aus der API (`PublicScanResource`/`ScanListResource` in der Laravel-App)
  und wird in `get_latest_scan`, `list_scans` und `compare_domains` nur durchgereicht —
  das URL-Schema `/scan/{public_id}` nie hier nachbauen. Bei privaten Scans trägt der Link
  nur für den eingeloggten Eigentümer; zum Weitergeben ist `share_url` gedacht.
- Claude Desktop unterstützt keinen `headers`-Parameter in `mcpServers` — `mcp-remote` als Wrapper nötig

## Deployment (Kurzform)

```bash
git pull
docker build -t wpperf-mcp .
docker compose up -d
docker logs -f wpperf-mcp
```

## Nginx Konfiguration
Datei: /etc/nginx/conf.d/mcp.conf (oder in bestehende turbometrics.io conf integrieren)
Proxy /mcp → localhost:3001
SSE erfordert: proxy_buffering off + proxy_read_timeout 86400

## Hinweise für Claude Code
- Immer src/api.js für API-Calls nutzen — nie direkt fetch() in Tools
- Neues Tool: Datei in src/tools/ erstellen + in src/server.js registrieren
- Keine DB-Verbindung — alles über turbometrics REST API
- Bei API-Fehlern: aussagekräftige MCP-Fehlermeldung zurückgeben, nie crashen
- Tool-Descriptions auf Englisch — MCP-Standard ist englischsprachig
- Input-Validierung in jedem Tool — nie rohe User-Eingaben an API weitergeben
