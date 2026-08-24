import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'https://turbometrics.io/api/v1';

// Der Host ohne /api/v1 — dort liegen die Discovery-Dokumente.
const ISSUER = API_BASE.replace(/\/api\/v1\/?$/, '');

const TOKEN_TTL_MS = 60_000;

// Kurzes Gedaechtnis: ohne das kostet jede MCP-Anfrage einen zusaetzlichen
// API-Aufruf; mit einem laengeren bliebe ein widerrufener Token zu lange
// gueltig.
const tokenCache = new Map();

export function resetTokenCache() {
  tokenCache.clear();
}

export function extractToken(req) {
  const auth = req.headers['authorization'] ?? '';

  if (!auth.startsWith('Bearer ')) {
    return null;
  }

  return auth.slice(7).trim() || null;
}

/**
 * Weist den Client auf den Authorization Server hin.
 *
 * Ohne diesen Header auf einem 401 findet Claude die Metadaten nicht und
 * bricht mit "Couldn't reach the MCP server" ab — der Fehler, wegen dem der
 * Server ueber die Connector-Oberflaeche bisher nicht anbindbar war.
 */
export function unauthorizedHeaders() {
  return {
    'WWW-Authenticate': `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`,
  };
}

export async function assertTokenValid(token, now = Date.now()) {
  const cached = tokenCache.get(token);

  if (cached && cached.until > now) {
    return;
  }

  let response;

  try {
    response = await fetch(`${API_BASE}/token-info`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    // Ein 500 brechen Clients ab; auf 401 erneuern sie und versuchen es
    // erneut. Bei einer wackelnden Verbindung ist das das bessere Verhalten.
    tokenCache.delete(token);
    throw unauthorized();
  }

  if (!response.ok) {
    tokenCache.delete(token);
    throw unauthorized();
  }

  tokenCache.set(token, { until: now + TOKEN_TTL_MS });
}

function unauthorized() {
  return Object.assign(new Error('invalid_token'), { status: 401 });
}
