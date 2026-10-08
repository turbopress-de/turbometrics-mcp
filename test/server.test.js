import { jest } from '@jest/globals';

// Mock all tools to avoid real API calls
const noop = async () => ({});
const makeTool = (name) => ({ name, description: name, inputSchema: { type: 'object', properties: {}, required: [] }, handler: noop });

jest.unstable_mockModule('../src/tools/listDomains.js', () => ({ listDomains: makeTool('list_domains') }));
jest.unstable_mockModule('../src/tools/getLatestScan.js', () => ({ getLatestScan: makeTool('get_latest_scan') }));
jest.unstable_mockModule('../src/tools/getScanHistory.js', () => ({ getScanHistory: makeTool('get_scan_history') }));
jest.unstable_mockModule('../src/tools/getFindings.js', () => ({ getFindings: makeTool('get_findings') }));
jest.unstable_mockModule('../src/tools/listAlerts.js', () => ({ listAlerts: makeTool('list_alerts') }));
jest.unstable_mockModule('../src/tools/getRumSummary.js', () => ({ getRumSummary: makeTool('get_rum_summary') }));
jest.unstable_mockModule('../src/tools/compareDomains.js', () => ({ compareDomains: makeTool('compare_domains') }));
jest.unstable_mockModule('../src/tools/triggerScan.js', () => ({ triggerScan: makeTool('trigger_scan') }));
jest.unstable_mockModule('../src/tools/markAlertsRead.js', () => ({ markAlertsRead: makeTool('mark_alerts_read') }));

const { createMcpServer, liveServerCount } = await import('../src/server.js');

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
