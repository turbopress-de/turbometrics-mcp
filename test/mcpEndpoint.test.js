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
const { liveServerCount } = await import('../src/server.js');
const { MODERN_PROTOCOL_VERSIONS } = await import('../src/protocolVersion.js');
const { LATEST_PROTOCOL_VERSION } = await import('@modelcontextprotocol/server');

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

// Revision 2026-07-28: kein initialize mehr, jede Anfrage traegt ihre Revision
// im _meta-Umschlag und im Kopf, dazu den Methodennamen.
const modern = (method, revision = '2026-07-28') =>
  post({
    jsonrpc: '2.0',
    id: 3,
    method,
    params: {
      _meta: {
        'io.modelcontextprotocol/protocolVersion': revision,
        'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  }, { 'MCP-Protocol-Version': revision, 'Mcp-Method': method });

const json = async (res) => {
  const text = await res.text();
  return text.trimStart().startsWith('{')
    ? JSON.parse(text)
    : JSON.parse(text.split('\n').find((l) => l.startsWith('data: ')).slice(6));
};

const waitForNoLiveServers = async () => {
  // res 'close' laeuft, nachdem der Client die Antwort hat — kurz nachfassen.
  for (let i = 0; i < 50 && liveServerCount() > 0; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('Revision 2026-07-28', () => {
  test('nennt sie in server/discover', async () => {
    const res = await modern('server/discover');
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.result.supportedVersions).toContain('2026-07-28');
    expect(body.result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('turbometrics');
  });

  test('protocolVersion.js kennt dieselben neuen Revisionen wie das SDK', async () => {
    // Das SDK fuehrt die Liste nur intern. Bringt ein Update eine weitere
    // Revision, wird dieser Test rot, bis MODERN_PROTOCOL_VERSIONS nachzieht.
    const body = await json(await modern('server/discover'));

    expect([...MODERN_PROTOCOL_VERSIONS].sort()).toEqual([...body.result.supportedVersions].sort());
  });

  test('beantwortet tools/list', async () => {
    const res = await modern('tools/list');

    expect(res.status).toBe(200);
    expect((await json(res)).result.tools.length).toBeGreaterThan(0);
  });

  test('antwortet auf eine unbekannte neuere Revision mit der Liste der bekannten', async () => {
    // Hier darf normalizeProtocolVersion nicht eingreifen: der Client der
    // neuen Reihe handelt anhand dieser Antwort selbst herunter.
    const res = await modern('server/discover', '2099-01-01');
    const body = await json(res);

    expect(res.status).toBe(400);
    expect(body.error.data.supported).toContain('2026-07-28');
    expect(body.error.data.requested).toBe('2099-01-01');
  });
});

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

  test('reicht ein 503 aus der Tokenpruefung mit Retry-After durch', async () => {
    // Faellt die Pruefung aus, darf das nicht als 401 herauskommen: sonst wirft
    // der Client eine funktionierende Autorisierung weg und der Nutzer muss
    // sich ohne Grund neu anmelden.
    assertTokenValid.mockRejectedValueOnce(
      Object.assign(new Error('token_check_unavailable'), { status: 503 })
    );

    const res = await toolsList();

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(res.headers.get('www-authenticate')).toBeNull();
  });

  test('laesst keinen Transport zurueck, wenn die Antwort durch ist', async () => {
    // Pro Anfrage entstand ein neuer McpServer samt Transport, und niemand
    // schloss sie je. Bei einem zustandslosen Server ist das ein Leck, das mit
    // jedem Aufruf waechst.
    await toolsList({ 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION });
    await waitForNoLiveServers();

    expect(liveServerCount()).toBe(0);
  });

  test('laesst auch auf dem Weg der Revision 2026-07-28 keinen Server zurueck', async () => {
    await modern('tools/list');
    // subscriptions/listen schliesst die Instanz, ohne sie je zu verbinden —
    // dort lief onclose nicht, und der Zaehler blieb stehen.
    const listen = await modern('subscriptions/listen');
    await listen.body?.cancel();
    await waitForNoLiveServers();

    expect(liveServerCount()).toBe(0);
  });

  test('nennt die eingesetzte Technik nicht', async () => {
    // X-Powered-By verraet ohne Not, was hier laeuft, und ist damit eine
    // Vorlage fuer die gezielte Suche nach passenden Schwachstellen. Der
    // Header hat keinen Nutzen fuer irgendeinen Client.
    const res = await toolsList({ 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION });

    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  test.each(['GET', 'DELETE'])('beantwortet %s mit 405', async (method) => {
    // Zustandslos gibt es keinen Strom zum Offenhalten und keine Sitzung zum
    // Beenden. SDK 1.x hielt bei GET einen stummen SSE-Strom offen.
    const res = await fetch(`${base}/mcp`, {
      method,
      headers: { Accept: 'text/event-stream', Authorization: 'Bearer egal' },
    });

    expect(res.status).toBe(405);
  });

  test('verlangt einen Token', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });
});
