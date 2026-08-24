import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';

/**
 * Stuft eine unbekannte Protokollrevision auf die neueste bekannte herunter.
 *
 * Der Transport weist einen `MCP-Protocol-Version`-Kopf, den er nicht kennt,
 * mit 400 ab. Am 2026-08-24 traf das jeden Werkzeugaufruf aus claude.ai:
 * Claude spricht eine Revision, die das SDK (1.30.0, neueste) noch nicht
 * fuehrt — es reicht bis 2025-11-25. Der Client faellt danach auf ein
 * erneutes `initialize` zurueck und handelt herunter, aber der Aufruf, der
 * den 400 kassiert hat, ist verloren. Fuer den Nutzer sieht das aus, als
 * antworte der Server auf alles mit 400.
 *
 * Die Herabstufung ist vertretbar, weil dieser Server zustandslos arbeitet:
 * jede Anfrage bekommt einen frischen Transport, der ohnehin nur die
 * Revisionen beherrscht, die das SDK mitbringt. Wir behaupten hier also
 * nichts, was wir nicht koennten — wir sagen es nur, statt die Anfrage
 * wegzuwerfen.
 *
 * Faellt weg, sobald das SDK die neuere Revision fuehrt: dann steht sie in
 * SUPPORTED_PROTOCOL_VERSIONS und dieser Zweig greift nicht mehr.
 *
 * @returns {string|null} die ersetzte Revision, sonst null
 */
export function normalizeProtocolVersion(req) {
  const requested = req.headers['mcp-protocol-version'];

  if (!requested || SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return null;
  }

  req.headers['mcp-protocol-version'] = LATEST_PROTOCOL_VERSION;

  // Entscheidend: der Transport laeuft ueber @hono/node-server, und der baut
  // seine Kopfzeilen ausschliesslich aus rawHeaders. Wer nur req.headers
  // aendert, aendert nichts, was beim Transport ankommt.
  const raw = req.rawHeaders;

  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i += 2) {
      if (String(raw[i]).toLowerCase() === 'mcp-protocol-version') {
        raw[i + 1] = LATEST_PROTOCOL_VERSION;
      }
    }
  }

  return requested;
}
