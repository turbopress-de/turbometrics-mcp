import { jest } from '@jest/globals';

// Der Token-Check haengt an einem HTTP-Aufruf gegen die Laravel-API. Fuer den
// Weg durch den Transport ist er nicht der Gegenstand, also wird er ersetzt.
const assertTokenValid = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../src/auth.js', () => ({
  assertTokenValid,
  extractToken: (req) => {
    const auth = req.headers['authorization'] ?? '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;
  },
  unauthorizedHeaders: () => ({ 'WWW-Authenticate': 'Bearer' }),
  resetTokenCache: () => {},
}));

const { createApp } = await import('../src/index.js');
const { LATEST_PROTOCOL_VERSION } = await import('@modelcontextprotocol/sdk/types.js');

let server;
let base;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise((done) => server.once('listening', done));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
});

const post = (body, headers = {}) =>
  fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer egal',
      ...headers,
    },
    body: JSON.stringify(body),
  });

const initialize = (headers = {}) =>
  post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  }, headers);

// Der Versionskopf wird beim initialize nicht geprueft — dort steht die
// Revision im Rumpf. Erst die Aufrufe danach tragen ihn, und genau die hat der
// Transport am 2026-08-24 mit 400 abgewiesen.
const toolsList = (headers = {}) =>
  post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, headers);

describe('POST /mcp', () => {
  test('beantwortet initialize ohne Versionskopf', async () => {
    expect((await initialize()).status).toBe(200);
  });

  test('beantwortet initialize mit bekanntem Versionskopf', async () => {
    const res = await initialize({ 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION });

    expect(res.status).toBe(200);
  });

  test('beantwortet tools/list mit bekanntem Versionskopf', async () => {
    expect((await toolsList({ 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION })).status).toBe(200);
  });

  test('beantwortet tools/list auch mit einer Revision, die das SDK nicht kennt', async () => {
    // Der eigentliche Regressionstest: am 2026-08-24 schickte claude.ai eine
    // neuere Revision, der Transport wies jeden Werkzeugaufruf mit 400 ab, und
    // fuer den Nutzer sah es aus, als sei der Endpunkt tot. Ohne die
    // Herabstufung in normalizeProtocolVersion ist dieser Test rot.
    const res = await toolsList({ 'MCP-Protocol-Version': '2099-01-01' });

    expect(res.status).toBe(200);
  });

  test('verlangt einen Token', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });
});
