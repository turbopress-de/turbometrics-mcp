import { jest } from '@jest/globals';

const mockApi = { get: jest.fn(), post: jest.fn() };
jest.unstable_mockModule('../src/api.js', () => ({ api: mockApi }));

const [
  { listDomains },
  { getLatestScan },
  { getScanHistory },
  { getFindings },
  { listAlerts },
  { getRumSummary },
  { compareDomains },
  { triggerScan },
  { markAlertsRead },
  { listScans },
  { getAlert },
  { getAccountInfo },
] = await Promise.all([
  import('../src/tools/listDomains.js'),
  import('../src/tools/getLatestScan.js'),
  import('../src/tools/getScanHistory.js'),
  import('../src/tools/getFindings.js'),
  import('../src/tools/listAlerts.js'),
  import('../src/tools/getRumSummary.js'),
  import('../src/tools/compareDomains.js'),
  import('../src/tools/triggerScan.js'),
  import('../src/tools/markAlertsRead.js'),
  import('../src/tools/listScans.js'),
  import('../src/tools/getAlert.js'),
  import('../src/tools/getAccountInfo.js'),
]);

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
      .mockResolvedValueOnce({ data: [{ public_id: 'SCAN123' }] })
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

  test('throws when no scan found', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await expect(getLatestScan.handler(TOKEN, { domain_url: 'https://unknown.com/' }))
      .rejects.toThrow('Kein fertiger Scan');
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
      .rejects.toThrow('Keine Scans gefunden für');
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
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts?status=open');
  });

  test('requests resolved alerts', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await listAlerts.handler(TOKEN, { status: 'resolved' });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts?status=resolved');
  });

  test('no query string for status=all', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await listAlerts.handler(TOKEN, { status: 'all' });
    expect(mockApi.get).toHaveBeenCalledWith(TOKEN, '/alerts');
  });

  test('maps alert fields', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [{ id: 1, domain: 'example.com', metric: 'score', threshold: 80, triggered_at: '2026-01-01T00:00:00Z', resolved_at: null }],
    });
    const result = await listAlerts.handler(TOKEN, { status: 'open' });
    expect(result[0]).toMatchObject({ id: 1, domain: 'example.com', metric: 'score' });
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
    expect(mockApi.get).toHaveBeenNthCalledWith(2, TOKEN, '/rum/sites/5/summary?period=30d');
  });

  test('throws when site not found', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [], meta: { current_page: 1, last_page: 1 } });
    await expect(getRumSummary.handler(TOKEN, { domain_url: 'https://unknown.com/' }))
      .rejects.toThrow('RUM-Site nicht gefunden');
  });

  test('returns correct summary shape', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: [{ id: 1, domain: 'example.com' }], meta: { current_page: 1, last_page: 1 } })
      .mockResolvedValueOnce({ data: { domain: 'example.com', period: '7d', cwv_pass: false, metrics: { LCP: { p75: 2500 } } } });

    const result = await getRumSummary.handler(TOKEN, { domain_url: 'https://example.com/', period: '7d' });
    expect(result).toEqual({ domain: 'example.com', period: '7d', cwv_pass: false, metrics: { LCP: { p75: 2500 } } });
  });
});

// ─── compareDomains ──────────────────────────────────────────────────────────
describe('compareDomains', () => {
  beforeEach(reset);

  const scanListA = { data: [{ public_id: 'A1' }] };
  const scanListB = { data: [{ public_id: 'B1' }] };
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

  test('throws when domain A has no scan', async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce(scanListB);
    await expect(compareDomains.handler(TOKEN, { domain_url_a: 'https://a.com/', domain_url_b: 'https://b.com/' }))
      .rejects.toThrow('Kein Scan gefunden für: https://a.com/');
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

  test('posts alert_ids to /alerts/mark-read', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Done' } });
    const result = await markAlertsRead.handler(TOKEN, { alert_ids: ['1', '2'] });
    expect(mockApi.post).toHaveBeenCalledWith(TOKEN, '/alerts/mark-read', { alert_ids: ['1', '2'] });
    expect(result.message).toBe('Done');
  });

  test('uses fallback message if API returns none', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });
    const result = await markAlertsRead.handler(TOKEN, { alert_ids: ['1'] });
    expect(result.message).toBeTruthy();
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
