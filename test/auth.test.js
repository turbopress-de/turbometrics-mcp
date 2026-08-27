import { jest } from '@jest/globals';

const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }));

const {
  unauthorizedHeaders,
  assertTokenValid,
  extractToken,
  resetTokenCache,
  cachedTokenCount,
} =
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

  test('meldet 503, wenn die API nicht erreichbar ist', async () => {
    // Nicht 401: "kann nicht pruefen" ist kein Urteil ueber den Token. Als 401
    // sah eine hakende API fuer den Nutzer aus wie eine abgelaufene Anmeldung.
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(assertTokenValid('egal')).rejects.toMatchObject({ status: 503 });
  });

  test('meldet 503, wenn die API selbst ausfaellt', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(assertTokenValid('egal')).rejects.toMatchObject({ status: 503 });
  });

  test('meldet 401 nur, wenn die API den Token wirklich ablehnt', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(assertTokenValid('egal')).rejects.toMatchObject({ status: 401 });
  });

  test('merkt sich einen unpruefbaren Token nicht als gueltig', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await expect(assertTokenValid('spaeter')).rejects.toMatchObject({ status: 503 });
    await expect(assertTokenValid('spaeter')).resolves.toBeUndefined();
  });
});

describe('Budget fuer fehlschlagende Pruefungen', () => {
  // Ohne Deckel ist /mcp ein Durchlauferhitzer: jeder anonyme Aufruf mit
  // irgendeinem Bearer kostet einen Aufruf der Laravel-API, und dort steht
  // keine Bremse, weil ungueltige Tokens die auth-Middleware nie passieren.
  test('hoert auf zu fragen, wenn zu viele Pruefungen scheitern', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    for (let i = 0; i < 200; i++) {
      await expect(assertTokenValid(`muell-${i}`, 1000)).rejects.toMatchObject({
        status: expect.any(Number),
      });
    }

    // Der Deckel liegt deutlich unter 200 — entscheidend ist, dass die Zahl
    // der Aufrufe nach oben begrenzt ist und nicht mit der Last mitwaechst.
    expect(mockFetch.mock.calls.length).toBeLessThan(200);
  });

  test('antwortet mit 503, sobald das Budget aufgebraucht ist', async () => {
    // 503 und nicht 401: der Server hat den Token nicht geprueft, also faellt
    // er auch kein Urteil ueber ihn. Ein 401 wuerde den Client dazu bringen,
    // eine funktionierende Anmeldung wegzuwerfen.
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    let letzter;
    for (let i = 0; i < 200; i++) {
      letzter = await assertTokenValid(`muell-${i}`, 1000).catch((e) => e);
    }

    expect(letzter).toMatchObject({ status: 503 });
  });

  test('fuellt das Budget im naechsten Zeitfenster wieder auf', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    for (let i = 0; i < 200; i++) {
      await assertTokenValid(`muell-${i}`, 1000).catch(() => {});
    }

    const verbraucht = mockFetch.mock.calls.length;

    await assertTokenValid('spaeter', 1000 + 61_000).catch(() => {});

    expect(mockFetch.mock.calls.length).toBe(verbraucht + 1);
  });

  test('laesst einen gueltigen Token auch dann durch, wenn er im Gedaechtnis steht', async () => {
    // Der Kern der Zusicherung: wer schon einmal erfolgreich geprueft wurde,
    // fasst das Budget nie an. Ein Ansturm auf /mcp darf angemeldete Nutzer
    // nicht aussperren.
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    await assertTokenValid('gut', 1000);

    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    for (let i = 0; i < 200; i++) {
      await assertTokenValid(`muell-${i}`, 1000).catch(() => {});
    }

    await expect(assertTokenValid('gut', 1000)).resolves.toBeUndefined();
  });

  test('erfolgreiche Pruefungen verbrauchen kein Budget', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    for (let i = 0; i < 200; i++) {
      await expect(assertTokenValid(`gut-${i}`, 1000)).resolves.toBeUndefined();
    }

    expect(mockFetch).toHaveBeenCalledTimes(200);
  });
});

describe('Gedaechtnis raeumt sich selbst', () => {
  test('haelt abgelaufene Eintraege nicht auf Dauer vor', async () => {
    // Die Map wuchs bisher unbegrenzt: geloescht wurde nur bei Fehlschlag,
    // nie nach Ablauf. Jeder je gesehene gueltige Token blieb im Klartext im
    // Speicher liegen, bis der Prozess neu startete.
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    for (let i = 0; i < 100; i++) {
      await assertTokenValid(`alt-${i}`, 1000);
    }

    await assertTokenValid('neu', 1000 + 61_000);

    expect(cachedTokenCount()).toBe(1);
  });
});
