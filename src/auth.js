import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE_URL || 'https://turbometrics.io/api/v1';

// Der Host ohne /api/v1 — dort liegen die Discovery-Dokumente.
const ISSUER = API_BASE.replace(/\/api\/v1\/?$/, '');

const TOKEN_TTL_MS = 60_000;

// Kurzes Gedaechtnis: ohne das kostet jede MCP-Anfrage einen zusaetzlichen
// API-Aufruf; mit einem laengeren bliebe ein widerrufener Token zu lange
// gueltig.
const tokenCache = new Map();

let lastSweep = 0;

/**
 * Deckel fuer Pruefungen, die kein gueltiges Urteil ergeben — pro Zeitfenster
 * und ueber alle Aufrufer zusammen.
 *
 * Der Grund: /mcp ist offen erreichbar, und ohne diesen Deckel kostet jeder
 * anonyme Aufruf mit irgendeinem Bearer genau einen Aufruf der Laravel-API.
 * Dort greift keine Bremse, weil ein ungueltiger Token die auth-Middleware nie
 * passiert und die Mengenbegrenzung dahinter liegt. Ein Ansturm auf diesen
 * Server war damit ein Ansturm auf die API.
 *
 * Bewusst global und nicht je IP: hinter Cloudflare und dem nginx-Proxy ist
 * die Absenderadresse hier nicht verlaesslich zu bestimmen — eine falsch
 * geratene IP wuerde entweder alle Nutzer in einen Topf werfen oder gar nichts
 * bremsen. Ein globaler Deckel braucht diese Zuordnung nicht.
 *
 * Erfolgreiche Pruefungen zaehlen NICHT mit. Deshalb ruehrt regulaerer Betrieb
 * das Budget nie an: ein angemeldeter Nutzer fragt hoechstens einmal pro
 * TOKEN_TTL_MS nach und bekommt jedes Mal ein gueltiges Urteil.
 */
// 120 und nicht knapper: im Regelbetrieb scheitert eine Pruefung nur, wenn ein
// Zugang gerade abgelaufen ist. Bei stuendlicher Gueltigkeit sind das selbst bei
// einigen hundert Verbindungen im Schnitt unter zehn pro Minute. Der Abstand
// dazu ist Absicht — der Deckel soll einen Ansturm kappen, nicht einen
// Stossbetrieb, in dem viele Zugaenge gleichzeitig ablaufen.
const MAX_FAILED_CHECKS = 120;
const FAILURE_WINDOW_MS = 60_000;

let failureWindowStart = 0;
let failuresInWindow = 0;

export function resetTokenCache() {
  tokenCache.clear();
  lastSweep = 0;
  failureWindowStart = 0;
  failuresInWindow = 0;
}

/** Nur fuer Tests: belegt, dass das Gedaechtnis sich raeumt. */
export function cachedTokenCount() {
  return tokenCache.size;
}

/**
 * Wirft abgelaufene Eintraege weg.
 *
 * Ohne das wuchs die Map unbegrenzt: geloescht wurde nur bei einem Fehlschlag,
 * nie nach Ablauf. Jeder je gesehene gueltige Token blieb damit im Klartext im
 * Speicher liegen, bis der Prozess neu startete.
 *
 * Hoechstens einmal pro Zeitfenster, damit der Durchlauf nicht an jeder
 * einzelnen Anfrage haengt.
 */
function sweep(now) {
  if (now - lastSweep < TOKEN_TTL_MS) {
    return;
  }

  lastSweep = now;

  for (const [token, entry] of tokenCache) {
    if (entry.until <= now) {
      tokenCache.delete(token);
    }
  }
}

/** true, solange in diesem Zeitfenster noch gefragt werden darf. */
function mayAskUpstream(now) {
  if (now - failureWindowStart >= FAILURE_WINDOW_MS) {
    failureWindowStart = now;
    failuresInWindow = 0;
  }

  return failuresInWindow < MAX_FAILED_CHECKS;
}

function countFailure() {
  failuresInWindow++;
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

  sweep(now);

  if (!mayAskUpstream(now)) {
    // Ungeprueft ist nicht ungueltig: der Server hat die API gar nicht erst
    // gefragt, faellt hier also kein Urteil ueber den Token. Ein 401 wuerde
    // den Client eine funktionierende Anmeldung wegwerfen lassen.
    tokenCache.delete(token);
    throw unavailable();
  }

  let response;

  try {
    response = await fetch(`${API_BASE}/token-info`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    // "Kann nicht pruefen" ist nicht dasselbe wie "abgelehnt". Als 401 sah eine
    // hakende API fuer den Nutzer aus wie eine abgelaufene Anmeldung, und der
    // Client warf eine funktionierende Autorisierung weg. 503 sagt, was
    // wirklich los ist, und laedt zum erneuten Versuch ein statt zum Neuanmelden.
    tokenCache.delete(token);
    countFailure();
    throw unavailable();
  }

  if (!response.ok) {
    tokenCache.delete(token);
    countFailure();

    // Nur ein Urteil der API ueber den Token ist ein Urteil. Faellt sie selbst
    // aus (5xx), ist der Token unbeurteilt — nicht ungueltig.
    throw response.status >= 500 ? unavailable() : unauthorized();
  }

  tokenCache.set(token, { until: now + TOKEN_TTL_MS });
}

function unauthorized() {
  return Object.assign(new Error('invalid_token'), { status: 401 });
}

function unavailable() {
  return Object.assign(new Error('token_check_unavailable'), { status: 503 });
}
