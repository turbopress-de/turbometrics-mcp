import {
  LATEST_PROTOCOL_VERSION,
  PROTOCOL_VERSION_META_KEY,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/server';

/**
 * Die Revisionen der neuen Reihe, die das SDK beherrscht. Das SDK fuehrt die
 * Liste nur intern; test/mcpEndpoint.test.js gleicht sie mit der Antwort auf
 * server/discover ab, damit sie bei einem SDK-Update nicht stehen bleibt.
 */
export const MODERN_PROTOCOL_VERSIONS = ['2026-07-28'];

export function isModernProtocolVersionKnown(version) {
  return MODERN_PROTOCOL_VERSIONS.includes(version);
}

/**
 * Ob die Nachricht ihre Revision selbst im Rumpf nennt (`_meta`-Umschlag der
 * Revision 2026-07-28 und spaeter).
 */
function claimsRevisionInBody(body) {
  const meta = body?.params?._meta;

  return meta !== null && typeof meta === 'object' && PROTOCOL_VERSION_META_KEY in meta;
}

/**
 * Stuft eine unbekannte Protokollrevision auf die neueste der 2025er-Reihe
 * herunter — aber nur bei Anfragen im alten Stil.
 *
 * Vorgeschichte: Am 2026-08-24 traf jeder Werkzeugaufruf aus claude.ai auf
 * 400, weil der Transport von SDK 1.x den `MCP-Protocol-Version`-Kopf
 * 2026-07-28 nicht kannte. Der Client handelte danach zwar per `initialize`
 * herunter, aber der Aufruf, der den 400 kassiert hatte, war verloren.
 *
 * Seit SDK 2.x (1.6.1) kennt der Server 2026-07-28 selbst. Der Schutz bleibt
 * fuer die naechste Revision, aber er unterscheidet jetzt zwei Faelle:
 *
 * - Nennt der Rumpf die Revision im `_meta`-Umschlag, ist das ein Client der
 *   neuen Reihe. Dem antwortet das SDK bei einer unbekannten Revision mit
 *   einem ordentlichen UnsupportedProtocolVersion samt Liste der unterstuetzten
 *   Revisionen, und der Client handelt daraufhin herunter. Hier umzuschreiben
 *   waere schaedlich: Kopf und Umschlag widersprachen sich dann, und das SDK
 *   weist genau das mit -32020 ab.
 * - Ohne Umschlag ist es eine Anfrage im 2025er-Stil. Die bedient der Server
 *   zustandslos und ohnehin nur in den Revisionen, die das SDK mitbringt. Wir
 *   behaupten mit der Herabstufung also nichts, was wir nicht koennten — wir
 *   sagen es nur, statt die Anfrage wegzuwerfen.
 *
 * @param body der bereits geparste Rumpf (bei GET/DELETE undefined)
 * @returns {string|null} die ersetzte Revision, sonst null
 */
export function normalizeProtocolVersion(req, body) {
  const requested = req.headers['mcp-protocol-version'];

  if (!requested || SUPPORTED_PROTOCOL_VERSIONS.includes(requested) || claimsRevisionInBody(body)) {
    return null;
  }

  req.headers['mcp-protocol-version'] = LATEST_PROTOCOL_VERSION;

  // Der Node-Adapter des SDK baut seine Request-Kopfzeilen heute aus
  // req.headers; der Transport von SDK 1.x las ueber @hono/node-server
  // ausschliesslich rawHeaders. Beide anzupassen haelt die Herabstufung
  // unabhaengig davon, welchen Weg ein kuenftiger Adapter nimmt.
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
