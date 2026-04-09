import { jest } from '@jest/globals';

const mockFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }));

const { apiRequest, api } = await import('../src/api.js');

const TOKEN = 'test-token';

function makeResponse(body, { status = 200, ok = true } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => mockFetch.mockReset());

describe('apiRequest', () => {
  test('sends Authorization header', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: [] }));
    await apiRequest(TOKEN, 'GET', '/domains');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  test('GET has no body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: [] }));
    await apiRequest(TOKEN, 'GET', '/domains');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  test('POST sends JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: { id: '123' } }));
    await apiRequest(TOKEN, 'POST', '/scans', { url: 'https://example.com' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ url: 'https://example.com' });
  });

  test('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: [{ id: 1 }] }));
    const result = await apiRequest(TOKEN, 'GET', '/domains');
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  test('returns null on 204', async () => {
    mockFetch.mockResolvedValue(makeResponse(null, { status: 204 }));
    const result = await apiRequest(TOKEN, 'GET', '/nothing');
    expect(result).toBeNull();
  });

  test('throws on 4xx with API message', async () => {
    mockFetch.mockResolvedValue(makeResponse({ message: 'Unauthorized' }, { status: 401, ok: false }));
    await expect(apiRequest(TOKEN, 'GET', '/domains'))
      .rejects.toThrow('API error 401 on GET /domains: Unauthorized');
  });

  test('throws on network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(apiRequest(TOKEN, 'GET', '/domains'))
      .rejects.toThrow('Network error calling GET /domains: ECONNREFUSED');
  });
});

describe('api shorthand', () => {
  test('api.get calls GET', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: [] }));
    await api.get(TOKEN, '/domains');
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET' }));
  });

  test('api.post calls POST', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: {} }));
    await api.post(TOKEN, '/scans', { url: 'x' });
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST' }));
  });
});
