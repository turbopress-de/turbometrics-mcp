import { jest } from '@jest/globals';

const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }));

const { unauthorizedHeaders, assertTokenValid, extractToken, resetTokenCache } =
  await import('../src/auth.js');

beforeEach(() => {
  mockFetch.mockReset();
  resetTokenCache();
});

describe('unauthorizedHeaders', () => {
  test('nennt die Adresse der Ressourcen-Metadaten', () => {
    // Ohne diesen Header findet kein Client den Authorization Server — die
    // gesamte Discovery-Kette haengt an dieser einen Zeile.
    expect(unauthorizedHeaders()['WWW-Authenticate']).toMatch(
      /^Bearer resource_metadata="https:\/\/.+\/\.well-known\/oauth-protected-resource"$/
    );
  });
});

describe('extractToken', () => {
  test('liest den Bearer aus dem Authorization-Header', () => {
    expect(extractToken({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
  });

  test('gibt null zurueck, wenn das Schema fehlt', () => {
    expect(extractToken({ headers: { authorization: 'abc' } })).toBeNull();
    expect(extractToken({ headers: {} })).toBeNull();
  });
});

describe('assertTokenValid', () => {
  test('laesst einen gueltigen Token durch', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await expect(assertTokenValid('gut')).resolves.toBeUndefined();
  });

  test('wirft 401, wenn die API den Token ablehnt', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(assertTokenValid('abgelaufen')).rejects.toMatchObject({ status: 401 });
  });

  test('fragt einen bekannten Token nicht erneut nach', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await assertTokenValid('gut');
    await assertTokenValid('gut');

    // Ohne das Gedaechtnis kostet jede MCP-Anfrage einen zusaetzlichen
    // API-Aufruf.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('fragt nach Ablauf des Gedaechtnisses wieder nach', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await assertTokenValid('gut', 0);
    await assertTokenValid('gut', 61_000);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('merkt sich einen abgelehnten Token nicht als gueltig', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await expect(assertTokenValid('erneuert')).rejects.toMatchObject({ status: 401 });
    await expect(assertTokenValid('erneuert')).resolves.toBeUndefined();
  });

  test('behandelt einen Netzwerkfehler als 401, nicht als 500', async () => {
    // Ein 500 brechen Clients ab; auf 401 erneuern sie und versuchen es
    // erneut — das ist bei einer wackelnden Verbindung das bessere Verhalten.
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(assertTokenValid('egal')).rejects.toMatchObject({ status: 401 });
  });
});
