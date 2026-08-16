import { api } from '../api.js';

export const listScans = {
  name: 'list_scans',
  description: 'Lists scans — filterable by domain, status and page.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'URL filter: only scans of this domain (e.g. https://example.com)',
      },
      status: {
        type: 'string',
        enum: ['queued', 'running', 'finished', 'failed'],
        description: 'Filter by scan status',
      },
      limit: {
        type: 'number',
        description: 'Number of results (default: 20, max: 50)',
        default: 20,
      },
      page: {
        type: 'number',
        description: 'Page (default: 1)',
        default: 1,
      },
    },
    required: [],
  },
  async handler(token, { domain, status, limit = 20, page = 1 }) {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    if (status) params.set('status', status);
    params.set('limit', String(Math.min(limit, 50)));
    params.set('page', String(page));

    const data = await api.get(token, `/scans?${params}`);
    const scans = data.data ?? [];
    const meta = data.meta ?? {};

    return {
      scans: scans.map((s) => ({
        public_id: s.public_id,
        status: s.status,
        submitted_url: s.submitted_url,
        region: s.region,
        requested_at: s.requested_at,
        finished_at: s.finished_at,
        scores: s.result?.scores ?? null,
      })),
      meta: {
        total: meta.total ?? null,
        current_page: meta.current_page ?? page,
        last_page: meta.last_page ?? 1,
      },
    };
  },
};
