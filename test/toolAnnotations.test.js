import { jest } from '@jest/globals';

// Wie in mcpEndpoint.test.js: die Tokenpruefung ist hier nicht Gegenstand.
jest.unstable_mockModule('../src/auth.js', () => ({
  assertTokenValid: jest.fn().mockResolvedValue(undefined),
  extractToken: (req) => {
    const auth = req.headers['authorization'] ?? '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;
  },
  unauthorizedHeaders: () => ({ 'WWW-Authenticate': 'Bearer' }),
  resetTokenCache: () => {},
}));

const { createApp } = await import('../src/index.js');
const { TOOLS } = await import('../src/server.js');
const { LATEST_PROTOCOL_VERSION } = await import('@modelcontextprotocol/sdk/types.js');

/**
 * Anthropic (Claude Connectors Directory) und OpenAI (ChatGPT-Plugin-
 * Verzeichnis) pruefen title, readOnlyHint, destructiveHint und openWorldHint
 * an jedem Werkzeug. Ein fehlender Hinweis ist dort ein Ablehnungsgrund, und
 * der Prueflauf liest tools/list — deshalb wird hier genau das abgefragt und
 * nicht nur die Definitionen in src/tools/.
 */
const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];

// Die bewusste Entscheidung je Werkzeug. Ein neues Werkzeug faellt hier auf,
// bis jemand seine Hinweise ausdruecklich eingetragen hat.
const EXPECTED = {
  list_domains:           { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_latest_scan:        { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_scan_history:       { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_findings:           { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  list_alerts:            { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_rum_summary:        { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_rum_metric_history: { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_rum_pages:          { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  compare_domains:        { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_account_info:       { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  list_scans:             { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  get_alert:              { readOnlyHint: true,  destructiveHint: false, openWorldHint: false },
  // Ruft beliebige fremde Websites ab — nach OpenAIs Lesart offene Welt.
  trigger_scan:           { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  // Aendert nur den Gelesen-Status im eigenen Konto, nichts geht verloren.
  mark_alerts_read:       { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

let server;
let listed;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer egal',
      'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });

  // Der Transport antwortet als SSE oder JSON, je nach Accept-Aushandlung.
  const text = await res.text();
  const json = text.trimStart().startsWith('{')
    ? JSON.parse(text)
    : JSON.parse(text.split('\n').find((l) => l.startsWith('data: ')).slice(6));

  listed = json.result.tools;
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
});

describe('tools/list', () => {
  test('lists every registered tool and no unexpected one', () => {
    expect(listed.map((t) => t.name).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(TOOLS).toHaveLength(Object.keys(EXPECTED).length);
  });

  test('every tool has a title, top-level and in annotations', () => {
    for (const tool of listed) {
      expect(typeof tool.title).toBe('string');
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.annotations.title).toBe(tool.title);
    }
  });

  test('every tool sets all hints explicitly', () => {
    for (const tool of listed) {
      for (const hint of HINTS) {
        expect([tool.name, hint, typeof tool.annotations[hint]]).toEqual([tool.name, hint, 'boolean']);
      }
    }
  });

  test('hints match the deliberate decision per tool', () => {
    for (const tool of listed) {
      expect([tool.name, tool.annotations]).toEqual([tool.name, expect.objectContaining(EXPECTED[tool.name])]);
    }
  });

  test('nested schemas keep their structure', () => {
    const byName = Object.fromEntries(listed.map((t) => [t.name, t]));

    expect(byName.mark_alerts_read.inputSchema.properties.alert_ids.items.type).toBe('integer');

    const auth = byName.trigger_scan.inputSchema.properties.auth;
    expect(auth.type).toBe('object');
    expect(Object.keys(auth.properties).sort()).toEqual(['header_name', 'header_value', 'password', 'type', 'username']);
    expect(auth.properties.type.enum).toEqual(['basic', 'header']);

    expect(byName.get_rum_metric_history.inputSchema.properties.days).toBeDefined();
  });

  test('tool descriptions are substantial enough to choose the right tool', () => {
    for (const tool of listed) {
      expect([tool.name, tool.description.length >= 80]).toEqual([tool.name, true]);
    }
  });
});
