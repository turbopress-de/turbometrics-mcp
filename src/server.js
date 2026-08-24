import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { extractToken } from './auth.js';

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

function jsonSchemaToZod(schema) {
  if (!schema || schema.type !== 'object') return z.object({});

  const shape = {};
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(props)) {
    let field;

    if (prop.enum) {
      field = z.enum(prop.enum);
    } else if (prop.type === 'string') {
      field = z.string();
    } else if (prop.type === 'number') {
      field = z.number();
    } else if (prop.type === 'boolean') {
      field = z.boolean();
    } else if (prop.type === 'array') {
      field = z.array(z.any());
    } else {
      field = z.any();
    }

    if (prop.description) {
      field = field.describe(prop.description);
    }

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

export function createMcpTransport(req) {
  const token = extractToken(req);
  if (!token) {
    throw Object.assign(new Error('Missing or invalid Authorization header'), { status: 401 });
  }

  const server = new McpServer({
    name: 'wpperf-mcp',
    version: '1.0.0',
  });

  for (const tool of TOOLS) {
    const zodSchema = jsonSchemaToZod(tool.inputSchema);

    server.tool(tool.name, tool.description, zodSchema.shape, async (args) => {
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

  server.connect(transport);

  return transport;
}
