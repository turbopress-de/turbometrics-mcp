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

const { createMcpTransport } = await import('../src/server.js');

function makeReq(authHeader) {
  return { headers: authHeader ? { authorization: authHeader } : {} };
}

// createMcpTransport wartet server.connect() ab und ist deshalb async. Das
// nach aussen sichtbare Verhalten ist unveraendert — index.js faengt den
// Fehler so oder so ab und antwortet mit 401; belegt in
// test/mcpEndpoint.test.js ('verlangt einen Token').
describe('createMcpTransport', () => {
  test('rejects with 401 when Authorization header is missing', async () => {
    await expect(createMcpTransport(makeReq(null))).rejects.toThrow(
      'Missing or invalid Authorization header'
    );
    await expect(createMcpTransport(makeReq(null))).rejects.toMatchObject({ status: 401 });
  });

  test('rejects with 401 when Authorization is not Bearer scheme', async () => {
    await expect(createMcpTransport(makeReq('Basic abc123'))).rejects.toThrow(
      'Missing or invalid Authorization header'
    );
  });

  test('rejects with 401 when Bearer token is empty', async () => {
    await expect(createMcpTransport(makeReq('Bearer '))).rejects.toThrow(
      'Missing or invalid Authorization header'
    );
  });

  test('returns transport object for valid Bearer token', async () => {
    const transport = await createMcpTransport(makeReq('Bearer valid-token-123'));
    expect(transport).toBeDefined();
    expect(typeof transport.handleRequest).toBe('function');
  });
});
