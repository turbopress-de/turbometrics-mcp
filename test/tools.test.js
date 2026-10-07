import { jest } from '@jest/globals';

const mockApi = { get: jest.fn(), post: jest.fn() };
jest.unstable_mockModule('../src/api.js', () => ({ api: mockApi }));

// Nacheinander statt Promise.all: seit mehrere Werkzeuge src/tools/domain.js
// teilen, scheitert das parallele Laden unter jest-ESM mit "not linked".
const { listDomains } = await import('../src/tools/listDomains.js');
const { getLatestScan } = await import('../src/tools/getLatestScan.js');
const { getScanHistory } = await import('../src/tools/getScanHistory.js');
const { getFindings } = await import('../src/tools/getFindings.js');
const { listAlerts } = await import('../src/tools/listAlerts.js');
const { getRumSummary } = await import('../src/tools/getRumSummary.js');
const { compareDomains } = await import('../src/tools/compareDomains.js');
const { triggerScan } = await import('../src/tools/triggerScan.js');
const { markAlertsRead } = await import('../src/tools/markAlertsRead.js');
const { listScans } = await import('../src/tools/listScans.js');
const { getAlert } = await import('../src/tools/getAlert.js');
const { getAccountInfo } = await import('../src/tools/getAccountInfo.js');
const { getRumMetricHistory } = await import('../src/tools/getRumMetricHistory.js');
const { getRumPages } = await import('../src/tools/getRumPages.js');

const TOKEN = 'test-token';
const reset = () => { mockApi.get.mockReset(); mockApi.post.mockReset(); };

// ─── listDomains ─────────────────────────────────────────────────────────────
describe('listDomains', () => {
  beforeEach(reset);

  test('returns mapped domain fields', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [{ host: 'example.com', url: 'https://example.com/', schedule: 'daily', is_active: true, last_dispatched_at: '2026-01-01T00:00:00Z' }],
      meta: { current_page: 1, last_page: 1 },
    });
    const result = await listDomains.handler(TOKEN, {});
    expect(result).toEqual([{ host: 'example.com', url: 'https://example.com/', schedule: 'daily', is_active: true, last_dispatched_at: '2026-01-01T00:00:00Z' }]);
  });

  test('fetches all pages', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ host: 'a.com', url: 'https://a.com/', schedule: 'daily', is_active: true, last_dispatched_at: null }], meta: { current_page: 1, last_page: 2 } })
      .mockResolvedValueOnce({ data: [{ host: 'b.com', url: 'https://b.com/', schedule: '1h', is_active: false, last_dispatched_at: null }], meta: { current_page: 2, last_page: 2 } });
    const result = await listDomains.handler(TOKEN, {});
    expect(result).toHaveLength(2);
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });
});

// ─── getLatestScan ───────────────────────────────────────────────────────────
describe('getLatestScan', () => {
  beforeEach(reset);

  test('does two-step call and maps result', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ public_id: 'SCAN123', submitted_url: 'https://example.com/' }] })
      .mockResolvedValueOnce({
        data: {
          public_id: 'SCAN123',
          result: {
            scores: { overall: 94 },
            metrics: { ttfb_ms: 215 },
            findings: [
              { severity: 'bad', title: 'Bad thing' },
              { severity: 'good', title: 'Good thing' },
            ],
            summary_short: 'Sieht gut aus.',
          },
        },
      });

    const result = await getLatestScan.handler(TOKEN, { domain_url: 'https://example.com/' });

    expect(mockApi.get).toHaveBeenCalledTimes(2);
    expect(mockApi.get).toHaveBeenNthCalledWith(1, TOKEN, expect.stringContaining('status=finished'));
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/scans/SCAN123');
    expect(result.public_id).toBe('SCAN123');
    expect(result.scores.overall).toBe(94);
    expect(result.metrics.ttfb_ms).toBe(215);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('bad');
    expect(result.summary_short).toBe('Sieht gut aus.');
  });

  test('passes report_url through', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ public_id: 'SCAN123', submitted_url: 'https://example.com/' }] })
      .mockResolvedValueOnce({
        data: {
          public_id: 'SCAN123',
          report_url: 'https://turbometrics.io/scan/SCAN123',
          result: { scores: { overall: 94 } },
        },
      });

    const result = await getLatestScan.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(result.report_url).toBe('https://turbometrics.io/scan/SCAN123');
  });

  test('report_url is null when the API does not send one', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ public_id: 'SCAN123', submitted_url: 'https://example.com/' }] })
      .mockResolvedValueOnce({ data: { public_id: 'SCAN123', result: {} } });

    const result = await getLatestScan.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(result.report_url).toBeNull();
  });

  test('throws when no scan found', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await expect(getLatestScan.handler(TOKEN, { domain_url: 'https://unknown.com/' }))
      .rejects.toThrow('No finished scan found');
  });
});

// ─── getScanHistory ──────────────────────────────────────────────────────────
describe('getScanHistory', () => {
  beforeEach(reset);

  test('looks up domain ID then fetches history', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 42, url: 'https://example.com/' }], meta: { current_page: 1, last_page: 1 } })
      .mockResolvedValueOnce({ data: [{ score: 90, created_at: '2026-01-01T00:00:00Z', region: 'de-nbg1' }] });

    const result = await getScanHistory.handler(TOKEN, { domain_url: 'https://example.com/' });

    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/domains/42/history');
    expect(result).toEqual([{ score: 90, created_at: '2026-01-01T00:00:00Z', region: 'de-nbg1' }]);
  });

  test('throws when domain not found and no scans exist', async () => {
    // findDomainId returns null (domains endpoint empty)
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } });
    // fallback scans endpoint also empty
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } });
    await expect(getScanHistory.handler(TOKEN, { domain_url: 'https://unknown.com/' }))
      .rejects.toThrow('No finished scans found');
  });

  test('searches multiple pages to find domain', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 1, url: 'https://other.com/' }], meta: { current_page: 1, last_page: 2 } })
      .mockResolvedValueOnce({ data: [{ id: 99, url: 'https://example.com/' }], meta: { current_page: 2, last_page: 2 } })
      .mockResolvedValueOnce({ data: [] });
    await getScanHistory.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(mockApi.get).toHaveBeenNthCalledWith(3, TOKEN, '/domains/99/history');
  });
});

// ─── getFindings ─────────────────────────────────────────────────────────────
describe('getFindings', () => {
  beforeEach(reset);

  test('returns mapped findings', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: { result: { findings: [{ title: 'Slow TTFB', severity: 'bad', message: 'Too slow', recommendation: 'Use cache' }] } },
    });
    const result = await getFindings.handler(TOKEN, { scan_id: 'SCAN123' });
    expect(result).toEqual([{ title: 'Slow TTFB', severity: 'bad', message: 'Too slow', recommendation: 'Use cache' }]);
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/scans/SCAN123');
  });

  test('returns empty array when no findings', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { result: {} } });
    const result = await getFindings.handler(TOKEN, { scan_id: 'X' });
    expect(result).toEqual([]);
  });
});

// ─── listAlerts ──────────────────────────────────────────────────────────────
describe('listAlerts', () => {
  beforeEach(reset);

  test('requests open alerts by default', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await listAlerts.handler(TOKEN, {});
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts?status=open&limit=50&page=1');
  });

  test('requests resolved alerts', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await listAlerts.handler(TOKEN, { status: 'resolved' });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts?status=resolved&limit=50&page=1');
  });

  test('no status filter for status=all', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await listAlerts.handler(TOKEN, { status: 'all', page: 2 });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts?limit=50&page=2');
  });

  test('maps the fields the API actually sends', async () => {
    // Form aus ApiAlertController::formatAlert. Bis 1.5.0 las das Werkzeug
    // domain/metric/threshold/triggered_at und lieferte leere Alerts.
    mockApi.get.mockResolvedValueOnce({
      data: [{
        id: 7, type: 'score_drop', severity: 'warning', title: 'Score dropped', message: 'From 90 to 70',
        is_read: false, is_dismissed: false, url: 'https://example.com/', host: 'example.com',
        scan_id: 'SCAN1', created_at: '2026-10-01T00:00:00Z', resolved_at: null,
      }],
      meta: { total: 1, current_page: 1, last_page: 1 },
    });
    const result = await listAlerts.handler(TOKEN, { status: 'open' });
    expect(result.alerts[0]).toEqual({
      id: 7, type: 'score_drop', severity: 'warning', title: 'Score dropped', message: 'From 90 to 70',
      host: 'example.com', url: 'https://example.com/', scan_id: 'SCAN1', is_read: false,
      created_at: '2026-10-01T00:00:00Z', resolved_at: null,
    });
    expect(result.meta).toEqual({ total: 1, current_page: 1, last_page: 1 });
  });
});

// ─── getRumSummary ───────────────────────────────────────────────────────────
describe('getRumSummary', () => {
  beforeEach(reset);

  test('extracts hostname and finds site by domain field', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 5, domain: 'example.com' }], meta: { current_page: 1, last_page: 1 } })
      .mockResolvedValueOnce({ data: { domain: 'example.com', period: '30d', cwv_pass: true, metrics: {} } });

    await getRumSummary.handler(TOKEN, { domain_url: 'https://example.com/', period: '30d' });
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/rum/sites/5/summary?period=30d&device=all');
  });

  test('throws when site not found', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } });
    await expect(getRumSummary.handler(TOKEN, { domain_url: 'https://unknown.com/' }))
      .rejects.toThrow('No RUM site found for unknown.com');
  });

  test('returns correct summary shape', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 1, domain: 'example.com' }], meta: { current_page: 1, last_page: 1 } })
      .mockResolvedValueOnce({ data: { domain: 'example.com', period: '7d', cwv_pass: false, metrics: { LCP: { p75: 2500 } } } });

    const result = await getRumSummary.handler(TOKEN, { domain_url: 'https://example.com/', period: '7d' });
    expect(result).toMatchObject({ domain: 'example.com', period: '7d', cwv_pass: false, metrics: { LCP: { p75: 2500 } } });
  });
});

// ─── compareDomains ──────────────────────────────────────────────────────────
describe('compareDomains', () => {
  beforeEach(reset);

  const scanListA = { data: [{ public_id: 'A1', submitted_url: 'https://a.com/' }] };
  const scanListB = { data: [{ public_id: 'B1', submitted_url: 'https://b.com/' }] };
  const detailA = { data: { public_id: 'A1', result: { scores: { overall: 94 }, metrics: { ttfb_ms: 200 }, findings: [] } } };
  const detailB = { data: { public_id: 'B1', result: { scores: { overall: 85 }, metrics: { ttfb_ms: 500 }, findings: [{ severity: 'bad' }, { severity: 'warning' }] } } };

  test('fetches detail scan for both domains', async () => {
    mockApi.get
      .mockResolvedValueOnce(scanListA)
      .mockResolvedValueOnce(scanListB)
      .mockResolvedValueOnce(detailA)
      .mockResolvedValueOnce(detailB);

    const result = await compareDomains.handler(TOKEN, { domain_url_a: 'https://a.com/', domain_url_b: 'https://b.com/' });

    expect(result.a.score).toBe(94);
    expect(result.b.score).toBe(85);
    expect(result.a.ttfb_ms).toBe(200);
    expect(result.b.bad_findings).toBe(1);
    expect(result.b.warning_findings).toBe(1);
  });

  test('passes report_url through for both sides', async () => {
    mockApi.get
      .mockResolvedValueOnce(scanListA)
      .mockResolvedValueOnce(scanListB)
      .mockResolvedValueOnce({ data: { public_id: 'A1', report_url: 'https://turbometrics.io/scan/A1', result: {} } })
      .mockResolvedValueOnce({ data: { public_id: 'B1', result: {} } });

    const result = await compareDomains.handler(TOKEN, { domain_url_a: 'https://a.com/', domain_url_b: 'https://b.com/' });

    expect(result.a.report_url).toBe('https://turbometrics.io/scan/A1');
    expect(result.b.report_url).toBeNull();
  });

  test('throws when domain A has no scan', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce(scanListB);
    await expect(compareDomains.handler(TOKEN, { domain_url_a: 'https://a.com/', domain_url_b: 'https://b.com/' }))
      .rejects.toThrow('No finished scan found for a.com');
  });
});

// ─── triggerScan ─────────────────────────────────────────────────────────────
describe('triggerScan', () => {
  beforeEach(reset);

  test('posts to /scans with url', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'NEW1', status: 'pending', cached: false } });
    await triggerScan.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/scans', { url: 'https://example.com/' });
  });

  test('returns cached flag and message when cached', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'OLD1', status: 'finished', cached: true } });
    const result = await triggerScan.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(result.cached).toBe(true);
    expect(result.message).toMatch(/force/i);
  });

  test('returns started message when not cached', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'NEW1', status: 'pending', cached: false } });
    const result = await triggerScan.handler(TOKEN, { domain_url: 'https://example.com/' });
    expect(result.cached).toBe(false);
    expect(result.message).toMatch(/queued|scan/i);
  });
});

// ─── markAlertsRead ──────────────────────────────────────────────────────────
describe('markAlertsRead', () => {
  beforeEach(reset);

  test('sends the IDs as integers under ids, the field the API reads', async () => {
    // Regressionstest: bis 1.5.0 ging 'alert_ids' raus. Die API kennt nur
    // 'ids' und markiert ohne es ALLE ungelesenen Alerts des Kontos.
    mockApi.post.mockResolvedValueOnce({ data: { marked_read: 2 } });
    const result = await markAlertsRead.handler(TOKEN, { alert_ids: [1, '2'] });
    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/alerts/mark-read', { ids: [1, 2] });
    expect(result).toEqual({ marked_read: 2, requested: 2 });
  });

  test('refuses an empty list instead of letting the API mark everything', async () => {
    await expect(markAlertsRead.handler(TOKEN, { alert_ids: [] })).rejects.toThrow(/non-empty/);
    await expect(markAlertsRead.handler(TOKEN, {})).rejects.toThrow(/non-empty/);
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('refuses IDs that are not positive integers', async () => {
    for (const bad of ['abc', 0, -3, 1.5, '12a', null]) {
      await expect(markAlertsRead.handler(TOKEN, { alert_ids: [bad] })).rejects.toThrow(/Invalid alert ID/);
    }
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('caps the number of IDs per call', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    await expect(markAlertsRead.handler(TOKEN, { alert_ids: ids })).rejects.toThrow(/At most 100/);
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});

// ─── listScans ───────────────────────────────────────────────────────────────
describe('listScans', () => {
  beforeEach(reset);

  test('calls /scans with default params', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } });
    await listScans.handler(TOKEN, {});
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('/scans?'));
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('limit=20'));
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('page=1'));
  });

  test('passes domain and status filters', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: {} });
    await listScans.handler(TOKEN, { domain: 'https://example.com', status: 'finished' });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('status=finished'));
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('domain='));
  });

  test('caps limit at 50', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: {} });
    await listScans.handler(TOKEN, { limit: 100 });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, expect.stringContaining('limit=50'));
  });

  test('maps scan fields and returns meta', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [{ public_id: 'S1', status: 'finished', submitted_url: 'https://example.com', region: 'de-nbg1', requested_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:01:00Z', result: { scores: { overall: 91 } } }],
      meta: { total: 1, current_page: 1, last_page: 1 },
    });
    const result = await listScans.handler(TOKEN, {});
    expect(result.scans).toHaveLength(1);
    expect(result.scans[0].public_id).toBe('S1');
    expect(result.scans[0].scores.overall).toBe(91);
    expect(result.meta.total).toBe(1);
  });

  test('passes report_url through, null when missing', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [
        { public_id: 'S1', report_url: 'https://turbometrics.io/scan/S1' },
        { public_id: 'S2' },
      ],
      meta: {},
    });
    const result = await listScans.handler(TOKEN, {});
    expect(result.scans[0].report_url).toBe('https://turbometrics.io/scan/S1');
    expect(result.scans[1].report_url).toBeNull();
  });
});

// ─── getAlert ────────────────────────────────────────────────────────────────
describe('getAlert', () => {
  beforeEach(reset);

  test('calls /alerts/{id} and returns data', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 7, domain: 'example.com', metric: 'score' } });
    const result = await getAlert.handler(TOKEN, { alert_id: '7' });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts/7');
    expect(result.id).toBe(7);
    expect(result.domain).toBe('example.com');
  });

  test('falls back to raw response if no data wrapper', async () => {
    mockApi.get.mockResolvedValueOnce({ id: 99, metric: 'lcp' });
    const result = await getAlert.handler(TOKEN, { alert_id: '99' });
    expect(result.id).toBe(99);
  });
});

// ─── getAccountInfo ──────────────────────────────────────────────────────────
describe('getAccountInfo', () => {
  beforeEach(reset);

  test('maps nested plan and api_usage fields from API response', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        plan: { key: 'pro', label: 'Pro', api_daily_limit: 5000 },
        api_usage: { used_today: 42, limit_today: 5000, reset_at: '2026-01-01T23:59:59+00:00' },
        rum: { enabled: true, sites_count: 2, monthly_limit: 100000, pageviews_this_month: 8000 },
      },
    });
    const result = await getAccountInfo.handler(TOKEN, {});
    expect(result.plan.key).toBe('pro');
    expect(result.plan.api_daily_limit).toBe(5000);
    expect(result.api_usage.used_today).toBe(42);
    expect(result.api_usage.limit_today).toBe(5000);
    expect(result.api_usage.reset_at).toBe('2026-01-01T23:59:59+00:00');
    expect(result.rum.enabled).toBe(true);
    expect(result.rum.sites_count).toBe(2);
    expect(result.rum.monthly_limit).toBe(100000);
  });

  test('returns safe defaults when plan/api_usage/rum are absent', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 2, name: 'X', email: 'x@y.com' } });
    const result = await getAccountInfo.handler(TOKEN, {});
    expect(result.plan.key).toBeUndefined();
    expect(result.api_usage.used_today).toBeUndefined();
    expect(result.rum.enabled).toBe(false);
    expect(result.rum.sites_count).toBe(0);
  });
});

// ─── triggerScan: Eingabepruefung ────────────────────────────────────────────
describe('triggerScan prueft die Eingabe', () => {
  beforeEach(reset);

  test('laesst eine URL ohne Schema unveraendert durch', async () => {
    // Die API ergaenzt fehlende Schemata selbst (UrlNormalizer). Wer hier auf
    // ein Schema besteht, nimmt dem Nutzer den Fall "scanne example.com" weg.
    mockApi.post.mockResolvedValueOnce({ data: { id: 'N', status: 'pending' } });

    await triggerScan.handler(TOKEN, { domain_url: 'example.com' });

    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/scans', { url: 'example.com' });
  });

  test('weist ein fremdes Schema ab, ohne die API zu fragen', async () => {
    await expect(
      triggerScan.handler(TOKEN, { domain_url: 'file:///etc/passwd' })
    ).rejects.toThrow(/http/i);

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('weist eine leere URL ab', async () => {
    await expect(triggerScan.handler(TOKEN, { domain_url: '   ' })).rejects.toThrow();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('weist eine ueberlange URL ab', async () => {
    // Dieselbe Grenze wie die API (max:2048) — sonst laeuft der Aufruf erst
    // dort auf einen Validierungsfehler.
    await expect(
      triggerScan.handler(TOKEN, { domain_url: 'https://e.de/' + 'a'.repeat(2100) })
    ).rejects.toThrow();

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('weist einen unbekannten auth-Typ ab', async () => {
    await expect(
      triggerScan.handler(TOKEN, {
        domain_url: 'https://example.com',
        auth: { type: 'oauth', token: 'geheim' },
      })
    ).rejects.toThrow(/basic|header/i);

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  test('reicht eine gueltige basic-Anmeldung durch', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 'N', status: 'pending' } });

    await triggerScan.handler(TOKEN, {
      domain_url: 'https://example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
    });

    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/scans', {
      url: 'https://example.com',
      auth: { type: 'basic', username: 'u', password: 'p' },
    });
  });

  test('reicht nur die bekannten auth-Felder weiter', async () => {
    // Sonst wandern beliebige Schluessel aus der Modelleingabe in den
    // API-Aufruf — das Schema stand auf z.any(), es gab also gar keine Pruefung.
    mockApi.post.mockResolvedValueOnce({ data: { id: 'N', status: 'pending' } });

    await triggerScan.handler(TOKEN, {
      domain_url: 'https://example.com',
      auth: { type: 'header', header_name: 'X-A', header_value: 'b', extra: 'weg' },
    });

    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/scans', {
      url: 'https://example.com',
      auth: { type: 'header', header_name: 'X-A', header_value: 'b' },
    });
  });
});

// ─── Abgleich mit der API (1.6.0) ────────────────────────────────────────────
describe('triggerScan regions', () => {
  beforeEach(reset);

  test('offers exactly the regions the API validates', async () => {
    // config/plans.php allowed_regions. Die frueheren eu/us/asia kannte die
    // API nicht, jeder Aufruf mit Region scheiterte an der Validierung.
    expect(triggerScan.inputSchema.properties.region.enum).toEqual(['de-fsn1', 'de-nbg1', 'fi-hel1']);
    mockApi.post.mockResolvedValueOnce({ data: { id: 'N', status: 'queued' } });
    await triggerScan.handler(TOKEN, { domain_url: 'https://example.com', region: 'fi-hel1' });
    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/scans', { url: 'https://example.com', region: 'fi-hel1' });
  });
});

describe('getScanHistory fallback', () => {
  beforeEach(reset);

  test('reads public_id, finished_at and result.scores.overall from the scan list', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } })
      .mockResolvedValueOnce({
        data: [{ public_id: 'S1', submitted_url: 'https://example.com/', region: 'de-fsn1', requested_at: '2026-10-01T10:00:00Z', finished_at: '2026-10-01T10:01:00Z', result: { scores: { overall: 77 } } }],
        meta: { current_page: 1, last_page: 1 },
      });
    const result = await getScanHistory.handler(TOKEN, { domain_url: 'example.com' });
    expect(result).toEqual([{ scan_id: 'S1', score: 77, created_at: '2026-10-01T10:01:00Z', region: 'de-fsn1' }]);
  });

  test('stops paging after a bounded number of pages', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } });
    for (let i = 0; i < 10; i++) {
      mockApi.get.mockResolvedValueOnce({ data: [{ public_id: `S${i}`, submitted_url: 'https://example.com/', result: null }], meta: { last_page: 10 } });
    }
    const result = await getScanHistory.handler(TOKEN, { domain_url: 'https://example.com' });
    expect(result).toHaveLength(4);
    expect(mockApi.get).toHaveBeenCalledTimes(5);
  });
});

describe('domain input without scheme', () => {
  beforeEach(reset);

  test('RUM tools accept example.com and match the host case-insensitively', async () => {
    // new URL('example.com') warf frueher einen nackten TypeError.
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 3, domain: 'example.com' }], meta: { last_page: 1 } })
      .mockResolvedValueOnce({ data: [] });
    const result = await getRumPages.handler(TOKEN, { domain_url: 'Example.com' });
    expect(result.domain).toBe('example.com');
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/rum/sites/3/pages?metric=LCP&period=24h&limit=25');
  });

  test('RUM metric history finds the site the same way', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 3, domain: 'example.com' }], meta: { last_page: 1 } })
      .mockResolvedValueOnce({ data: [{ date: '2026-10-01', p75: 2100, p50: 1500, samples: 40 }] });
    const result = await getRumMetricHistory.handler(TOKEN, { domain_url: 'example.com', metric: 'LCP' });
    expect(result.history).toEqual([{ date: '2026-10-01', p75: 2100, p50: 1500, samples: 40 }]);
  });
});

describe('compareDomains lab metrics', () => {
  beforeEach(reset);

  test('includes desktop and mobile lab metrics', async () => {
    const detail = (id) => ({ data: { public_id: id, result: { scores: { overall: 90 }, metrics: { ttfb_ms: 100, desktop: { lcp_ms: 1200, cls: 0.01, fcp_ms: 800, tbt_ms: 50 }, mobile: { lcp_ms: 2500 } }, findings: [] } } });
    mockApi.get
      .mockResolvedValueOnce({ data: [{ public_id: 'A1', submitted_url: 'https://a.com/' }] })
      .mockResolvedValueOnce({ data: [{ public_id: 'B1', submitted_url: 'https://b.com/' }] })
      .mockResolvedValueOnce(detail('A1'))
      .mockResolvedValueOnce(detail('B1'));
    const result = await compareDomains.handler(TOKEN, { domain_url_a: 'a.com', domain_url_b: 'b.com' });
    expect(result.a.desktop).toEqual({ lcp_ms: 1200, fcp_ms: 800, cls: 0.01, tbt_ms: 50 });
    expect(result.a.mobile.lcp_ms).toBe(2500);
  });
});

describe('scan lookup by domain', () => {
  beforeEach(reset);

  test('skips scans of other hosts that only contain the name', async () => {
    // /scans?domain= ist ein LIKE. "example.com" trifft auch myexample.com
    // und example.com.au — frueher nahm limit=1 einfach den neuesten davon.
    mockApi.get
      .mockResolvedValueOnce({ data: [
        { public_id: 'WRONG1', submitted_url: 'https://myexample.com/' },
        { public_id: 'WRONG2', submitted_url: 'https://example.com.au/' },
        { public_id: 'RIGHT', submitted_url: 'https://www.example.com/blog' },
      ] })
      .mockResolvedValueOnce({ data: { public_id: 'RIGHT', submitted_url: 'https://www.example.com/blog', result: {} } });

    const result = await getLatestScan.handler(TOKEN, { domain_url: 'example.com' });

    expect(mockApi.get).toHaveBeenNthCalledWith(1, TOKEN, '/scans?domain=example.com&status=finished&limit=50');
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/scans/RIGHT');
    expect(result.submitted_url).toBe('https://www.example.com/blog');
  });

  test('errors instead of answering with another site', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ public_id: 'X', submitted_url: 'https://shop.example.com/' }] });
    await expect(getLatestScan.handler(TOKEN, { domain_url: 'example.com' })).rejects.toThrow('No finished scan found for example.com');
  });

  test('history fallback drops look-alike hosts', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [], meta: { last_page: 1 } })
      .mockResolvedValueOnce({ data: [
        { public_id: 'A', submitted_url: 'https://example.com/', finished_at: 't1', result: { scores: { overall: 80 } } },
        { public_id: 'B', submitted_url: 'https://notexample.com/', finished_at: 't2', result: { scores: { overall: 20 } } },
      ], meta: { last_page: 1 } });
    const result = await getScanHistory.handler(TOKEN, { domain_url: 'https://example.com' });
    expect(result.map((e) => e.scan_id)).toEqual(['A']);
  });

  test('RUM lookup ignores a leading www on either side', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 9, domain: 'example.com' }], meta: { last_page: 1 } })
      .mockResolvedValueOnce({ data: { domain: 'example.com', metrics: {} } });
    await getRumSummary.handler(TOKEN, { domain_url: 'https://www.example.com' });
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/rum/sites/9/summary?period=30d&device=all');
  });
});

describe('getAccountInfo daily limit', () => {
  beforeEach(reset);

  test('reports an unlimited plan as null, not as an exhausted 0', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { plan: { key: 'agency', api_daily_limit: 0 }, api_usage: { used_today: 12, limit_today: 0 } } });
    const result = await getAccountInfo.handler(TOKEN);
    expect(result.plan.api_daily_limit).toBeNull();
    expect(result.api_usage.limit_today).toBeNull();
  });

  test('keeps a real limit', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { plan: { api_daily_limit: 1000 }, api_usage: { limit_today: 1000 } } });
    const result = await getAccountInfo.handler(TOKEN);
    expect(result.plan.api_daily_limit).toBe(1000);
  });
});
