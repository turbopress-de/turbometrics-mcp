import { resolve } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { mcpHandler } from './server.js';
import { assertTokenValid, extractToken, unauthorizedHeaders } from './auth.js';
import { isModernProtocolVersionKnown, normalizeProtocolVersion } from './protocolVersion.js';

const PORT = process.env.PORT || 3001;

const nodeHandler = toNodeHandler(mcpHandler);

/**
 * Ein abgelaufener Token muss auf HTTP-Ebene als 401 herauskommen, nicht als
 * Werkzeug-Fehlertext: Clients erneuern reaktiv auf 401. Kommt stattdessen ein
 * 200 mit Fehlertext, erneuert Claude nie und die Verbindung bleibt tot, bis
 * jemand sie von Hand neu aufbaut.
 */
async function handleMcp(req, res, body) {
  try {
    const token = extractToken(req);

    if (!token) {
      throw Object.assign(new Error('Missing or invalid Authorization header'), { status: 401 });
    }

    await assertTokenValid(token);

    const downgraded = normalizeProtocolVersion(req, body);

    if (downgraded) {
      // Die einzige Spur, an der sich ablesen laesst, welche Revision die
      // Clients inzwischen sprechen — und wann das SDK nachziehen sollte.
      // Eine Revision, die das SDK fuehrt, kam hier nur ohne _meta-Umschlag
      // an: dann liegt es am Client, nicht am SDK.
      const reason = isModernProtocolVersionKnown(downgraded)
        ? 'Kopf ohne _meta-Umschlag'
        : 'SDK kennt sie nicht';
      console.log(`Protokollrevision ${downgraded} herabgestuft (${reason})`);
    }

    // toNodeHandler reicht req.auth als authInfo an die Fabrik in server.js
    // weiter. clientId und scopes verlangt der Typ; ausgewertet werden sie
    // nicht, die Rechte prueft die Laravel-API am Token selbst.
    req.auth = { token, clientId: 'turbometrics', scopes: [] };

    await nodeHandler(req, res, body);
  } catch (err) {
    const status = err.status ?? 500;

    if (!res.headersSent) {
      if (status === 401) {
        res.set(unauthorizedHeaders());
      }

      if (status === 503) {
        // Ohne diesen Hinweis behandeln manche Clients einen 503 wie einen
        // endgueltigen Fehler, statt es gleich noch einmal zu versuchen.
        res.set({ 'Retry-After': '5' });
      }

      res.status(status).json({ error: err.message });
    }
  }
}

/**
 * Die App wird gebaut statt beim Import gestartet, damit der Integrationstest
 * sie auf einem eigenen Port hochziehen kann. Ohne diese Trennung laesst sich
 * der Weg durch den echten Transport nur von Hand pruefen — und genau dort sass
 * der Fehler, der am 2026-08-24 jeden Werkzeugaufruf mit 400 beantwortet hat.
 */
export function createApp() {
  const app = express();

  // Express setzt sonst X-Powered-By auf jede Antwort. Das verraet ohne Not,
  // was hier laeuft, und ist eine Vorlage fuer die gezielte Suche nach
  // passenden Schwachstellen. Kein Client braucht den Header.
  app.disable('x-powered-by');

  app.use(express.json());

  app.post('/mcp', (req, res) => handleMcp(req, res, req.body));
  app.get('/mcp', (req, res) => handleMcp(req, res, undefined));
  app.delete('/mcp', (req, res) => handleMcp(req, res, undefined));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

const startedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (startedDirectly) {
  createApp().listen(PORT, () => {
    console.log(`wpperf-mcp läuft auf Port ${PORT}`);
  });
}
