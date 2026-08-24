import express from 'express';
import { createMcpTransport } from './server.js';
import { assertTokenValid, extractToken, unauthorizedHeaders } from './auth.js';
import { normalizeProtocolVersion } from './protocolVersion.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());

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

    const downgraded = normalizeProtocolVersion(req);

    if (downgraded) {
      // Die einzige Spur, an der sich ablesen laesst, welche Revision die
      // Clients inzwischen sprechen — und wann das SDK nachziehen sollte.
      console.log(`Protokollrevision ${downgraded} herabgestuft (SDK kennt sie nicht)`);
    }

    const transport = createMcpTransport(req);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    const status = err.status ?? 500;

    if (!res.headersSent) {
      if (status === 401) {
        res.set(unauthorizedHeaders());
      }

      res.status(status).json({ error: err.message });
    }
  }
}

app.post('/mcp', (req, res) => handleMcp(req, res, req.body));
app.get('/mcp', (req, res) => handleMcp(req, res, undefined));
app.delete('/mcp', (req, res) => handleMcp(req, res, undefined));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`wpperf-mcp läuft auf Port ${PORT}`);
});
