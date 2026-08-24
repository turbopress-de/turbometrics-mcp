import { jest } from '@jest/globals';

const { normalizeProtocolVersion } = await import('../src/protocolVersion.js');
const { LATEST_PROTOCOL_VERSION } = await import('@modelcontextprotocol/sdk/types.js');

const reqWith = (version) => ({
  headers: version === undefined ? {} : { 'mcp-protocol-version': version },
  // Der Transport liest ueber @hono/node-server ausschliesslich rawHeaders.
  // Wer nur req.headers aendert, aendert nichts, was ankommt — genau dieser
  // Irrtum kostete am 2026-08-24 einen Durchgang.
  rawHeaders: version === undefined
    ? ['Accept', 'application/json']
    : ['Accept', 'application/json', 'MCP-Protocol-Version', version],
});

describe('normalizeProtocolVersion', () => {
  test('laesst eine bekannte Version unangetastet', () => {
    const req = reqWith('2025-06-18');

    expect(normalizeProtocolVersion(req)).toBeNull();
    expect(req.headers['mcp-protocol-version']).toBe('2025-06-18');
  });

  test('laesst eine fehlende Angabe unangetastet', () => {
    const req = reqWith(undefined);

    expect(normalizeProtocolVersion(req)).toBeNull();
    expect(req.headers['mcp-protocol-version']).toBeUndefined();
  });

  test('setzt eine unbekannte Version auf die neueste bekannte herunter', () => {
    // Claude spricht eine Revision, die das SDK noch nicht kennt. Ohne diese
    // Herabstufung weist der Transport jede Anfrage mit 400 ab — der Client
    // faellt zwar auf initialize zurueck, aber jeder Werkzeugaufruf davor
    // ist verloren.
    const req = reqWith('2026-05-14');

    expect(normalizeProtocolVersion(req)).toBe('2026-05-14');
    expect(req.headers['mcp-protocol-version']).toBe(LATEST_PROTOCOL_VERSION);
    expect(req.rawHeaders).toEqual(['Accept', 'application/json', 'MCP-Protocol-Version', LATEST_PROTOCOL_VERSION]);
  });

  test('trifft den Kopf in rawHeaders unabhaengig von der Schreibweise', () => {
    const req = {
      headers: { 'mcp-protocol-version': '2026-05-14' },
      rawHeaders: ['mcp-protocol-VERSION', '2026-05-14'],
    };

    normalizeProtocolVersion(req);

    expect(req.rawHeaders[1]).toBe(LATEST_PROTOCOL_VERSION);
  });

  test('kommt ohne rawHeaders zurecht', () => {
    const req = { headers: { 'mcp-protocol-version': '2026-05-14' } };

    expect(() => normalizeProtocolVersion(req)).not.toThrow();
    expect(req.headers['mcp-protocol-version']).toBe(LATEST_PROTOCOL_VERSION);
  });

  test('meldet die ersetzte Version zurueck, damit sie protokolliert werden kann', () => {
    // Der Rueckgabewert ist die einzige Spur, an der sich ablesen laesst,
    // welche Revision die Clients inzwischen sprechen.
    expect(normalizeProtocolVersion(reqWith('2027-01-01'))).toBe('2027-01-01');
  });
});
