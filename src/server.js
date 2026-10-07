import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { readFileSync } from 'fs';

import { extractToken } from './auth.js';

const { version: SERVER_VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

import { listDomains } from './tools/listDomains.js';
import { getLatestScan } from './tools/getLatestScan.js';
import { getScanHistory } from './tools/getScanHistory.js';
import { getFindings } from './tools/getFindings.js';
import { listAlerts } from './tools/listAlerts.js';
import { getRumSummary } from './tools/getRumSummary.js';
import { getRumMetricHistory } from './tools/getRumMetricHistory.js';
import { getRumPages } from './tools/getRumPages.js';
import { compareDomains } from './tools/compareDomains.js';
import { triggerScan } from './tools/triggerScan.js';
import { markAlertsRead } from './tools/markAlertsRead.js';
import { getAccountInfo } from './tools/getAccountInfo.js';
import { listScans } from './tools/listScans.js';
import { getAlert } from './tools/getAlert.js';

// Ausgefuehrt statt nur intern gehalten: der Sprachwaechter in
// test/toolDescriptionsEnglish.test.js prueft genau die Liste, die hier
// registriert wird. Wuerde er die Werkzeuge einzeln importieren, bliebe ein
// neu dazugekommenes unbemerkt — der haeufigste Weg, auf dem so eine
// Zusicherung verrottet.
export const TOOLS = [
  listDomains,
  getLatestScan,
  getScanHistory,
  getFindings,
  listAlerts,
  getRumSummary,
  getRumMetricHistory,
  getRumPages,
  compareDomains,
  triggerScan,
  markAlertsRead,
  getAccountInfo,
  listScans,
  getAlert,
];

/**
 * Ein Feld aus dem JSON-Schema eines Werkzeugs als zod-Typ.
 *
 * Bis 1.5.0 wurden verschachtelte Objekte zu z.any() und Arrays zu
 * z.array(z.any()) — trigger_scan.auth und mark_alerts_read.alert_ids standen
 * im ausgelieferten Schema also ohne jede Struktur da. Die Verzeichnisse von
 * Anthropic und OpenAI lesen genau dieses Schema; ein Prueflauf sieht dort,
 * was das Modell sieht.
 */
function fieldToZod(prop) {
  let field;

  if (prop.enum) {
    field = prop.enum.every((v) => typeof v === 'string')
      ? z.enum(prop.enum)
      : z.union(prop.enum.map((v) => z.literal(v)));
  } else if (prop.type === 'string') {
    field = z.string();
  } else if (prop.type === 'integer') {
    field = z.number().int();
  } else if (prop.type === 'number') {
    field = z.number();
  } else if (prop.type === 'boolean') {
    field = z.boolean();
  } else if (prop.type === 'array') {
    field = z.array(prop.items ? fieldToZod(prop.items) : z.any());
  } else if (prop.type === 'object' && prop.properties) {
    field = jsonSchemaToZod(prop);
  } else {
    field = z.any();
  }

  if (prop.description) {
    field = field.describe(prop.description);
  }

  return field;
}

export function jsonSchemaToZod(schema) {
  if (!schema || schema.type !== 'object') return z.object({});

  const shape = {};
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(props)) {
    let field = fieldToZod(prop);

    if (!required.has(key)) {
      if (prop.default !== undefined) {
        field = field.default(prop.default);
      } else {
        field = field.optional();
      }
    }

    shape[key] = field;
  }

  return z.object(shape);
}

// Pro Anfrage entsteht ein eigener McpServer samt Transport — der Server
// arbeitet zustandslos. Bisher wurde keiner davon je geschlossen; der Zaehler
// belegt in test/mcpEndpoint.test.js, dass das Aufraeumen wirklich laeuft.
let liveTransports = 0;

export function liveTransportCount() {
  return liveTransports;
}

/**
 * @param res optional. Ist eine Antwort dabei, haengt sich das Aufraeumen an
 *            ihr Ende — bei SSE also an den Moment, in dem der Client geht.
 */
export async function createMcpTransport(req, res) {
  const token = extractToken(req);
  if (!token) {
    throw Object.assign(new Error('Missing or invalid Authorization header'), { status: 401 });
  }

  // Name und Version stehen in serverInfo und sind das Erste, was ein
  // Verzeichnis-Prueflauf vom Server sieht. Bis 1.5.0 stand dort der interne
  // Projektname 'wpperf-mcp' mit einer nie gepflegten Version 1.0.0.
  const server = new McpServer({
    name: 'turbometrics',
    title: 'turbometrics',
    version: SERVER_VERSION,
  });

  for (const tool of TOOLS) {
    const zodSchema = jsonSchemaToZod(tool.inputSchema);

    // registerTool statt des veralteten server.tool(): nur hier lassen sich
    // title und annotations mitgeben, die beide Verzeichnisse an jedem
    // Werkzeug verlangen (siehe src/tools/annotations.js).
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: zodSchema.shape,
      annotations: { title: tool.title, ...tool.annotations },
    }, async (args) => {
      try {
        const result = await tool.handler(token, args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: err.message,
            },
          ],
        };
      }
    });
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Abgewartet: connect() verdrahtet die Handler zwar synchron, laeuft danach
  // aber noch in transport.start(). Ohne await beginnt handleRequest unter
  // Umstaenden, bevor der Transport fertig gestartet ist.
  await server.connect(transport);

  liveTransports++;

  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    liveTransports--;

    // server.close() schliesst den Transport mit; der zweite Aufruf ist die
    // Absicherung fuer den Fall, dass connect() schon getrennt war.
    await server.close().catch(() => {});
    await transport.close().catch(() => {});
  };

  res?.once('close', cleanup);

  return transport;
}
