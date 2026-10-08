import { jest } from '@jest/globals';

// Mock all tools to avoid real API calls
const noop = async () => ({});
const makeTool = (name) => ({ name, description: name, inputSchema: { type: 'object', properties: {}, required: [] }, handler: noop });

// list_domains gibt den Token zurueck, mit dem es aufgerufen wurde — daran
// haengt der Test, dass jede Anfrage ihren eigenen Token sieht.
jest.unstable_mockModule('../src/tools/listDomains.js', () => ({
  listDomains: { ...makeTool('list_domains'), handler: async (token) => ({ token }) },
}));
jest.unstable_mockModule('../src/tools/getLatestScan.js', () => ({ getLatestScan: makeTool('get_latest_scan') }));
jest.unstable_mockModule('../src/tools/getScanHistory.js', () => ({ getScanHistory: makeTool('get_scan_history') }));
jest.unstable_mockModule('../src/tools/getFindings.js', () => ({ getFindings: makeTool('get_findings') }));
jest.unstable_mockModule('../src/tools/listAlerts.js', () => ({ listAlerts: makeTool('list_alerts') }));
jest.unstable_mockModule('../src/tools/getRumSummary.js', () => ({ getRumSummary: makeTool('get_rum_summary') }));
jest.unstable_mockModule('../src/tools/compareDomains.js', () => ({ compareDomains: makeTool('compare_domains') }));
jest.unstable_mockModule('../src/tools/triggerScan.js', () => ({ triggerScan: makeTool('trigger_scan') }));
jest.unstable_mockModule('../src/tools/markAlertsRead.js', () => ({ markAlertsRead: makeTool('mark_alerts_read') }));

const { createMcpServer, liveServerCount, mcpHandler } = await import('../src/server.js');

// Die Pruefung auf einen fehlenden Token sitzt zusaetzlich zu der in index.js
// auch hier, damit kein Weg einen McpServer ohne Token baut. Dass index.js den
// Fehler als 401 beantwortet, belegt test/mcpEndpoint.test.js
// ('verlangt einen Token').
describe('createMcpServer', () => {
  test.each([undefined, null, ''])('rejects with 401 without token (%p)', (token) => {
    expect(() => createMcpServer(token)).toThrow('Missing or invalid Authorization header');

    try {
      createMcpServer(token);
    } catch (err) {
      expect(err.status).toBe(401);
    }
  });

  test('returns a server for a token and counts it until closed', async () => {
    const before = liveServerCount();
    const server = createMcpServer('valid-token-123');

    expect(typeof server.registerTool).toBe('function');
    expect(liveServerCount()).toBe(before + 1);

    // Ohne Transport loest close() kein onclose aus; das SDK verbindet die
    // Instanz in beiden Wegen, bevor es sie schliesst. Hier also direkt.
    server.server.onclose();
    server.server.onclose();

    expect(liveServerCount()).toBe(before);
  });
});

describe('mcpHandler', () => {
  const callListDomains = async (token, modern) => {
    const meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
      'io.modelcontextprotocol/clientCapabilities': {},
    };

    const res = await mcpHandler.fetch(new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': modern ? '2026-07-28' : '2025-11-25',
        ...(modern && { 'Mcp-Method': 'tools/call', 'Mcp-Name': 'list_domains' }),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_domains', arguments: {}, ...(modern && { _meta: meta }) },
      }),
    }), { authInfo: { token, clientId: 'turbometrics', scopes: [] } });

    const text = await res.text();
    const json = text.trimStart().startsWith('{')
      ? JSON.parse(text)
      : JSON.parse(text.split('\n').find((l) => l.startsWith('data: ')).slice(6));

    return JSON.parse(json.result.content[0].text).token;
  };

  // Der Server baut pro Anfrage einen McpServer mit dem Token des Aufrufers.
  // Wuerde ihn jemand zwischenspeichern, saehe ein Kunde die Daten des
  // vorigen — dieser Test faellt dann auf.
  test.each([false, true])('hands each request its own token (modern: %p)', async (modern) => {
    const [a, b] = await Promise.all([
      callListDomains('token-a', modern),
      callListDomains('token-b', modern),
    ]);

    expect([a, b]).toEqual(['token-a', 'token-b']);
  });
});
