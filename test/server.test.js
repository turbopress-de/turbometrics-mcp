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

describe('createMcpTransport', () => {
  test('throws 401 when Authorization header is missing', () => {
    expect(() => createMcpTransport(makeReq(null))).toThrow('Missing or invalid Authorization header');
    try {
      createMcpTransport(makeReq(null));
    } catch (err) {
      expect(err.status).toBe(401);
    }
  });

  test('throws 401 when Authorization is not Bearer scheme', () => {
    expect(() => createMcpTransport(makeReq('Basic abc123'))).toThrow('Missing or invalid Authorization header');
  });

  test('throws 401 when Bearer token is empty', () => {
    expect(() => createMcpTransport(makeReq('Bearer '))).toThrow('Missing or invalid Authorization header');
  });

  test('returns transport object for valid Bearer token', () => {
    const transport = createMcpTransport(makeReq('Bearer valid-token-123'));
    expect(transport).toBeDefined();
    expect(typeof transport.handleRequest).toBe('function');
  });
});
