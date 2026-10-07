import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

export const listScans = {
  name: 'list_scans',
  title: 'List scans',
  description: 'Lists the user\'s own scans, newest first, with public_id, status (queued, running, finished or failed), scanned URL, region, request and finish time, scores and a report link. Optionally filter by domain (substring match on the URL) and status; paginated with limit and page. Use a public_id with get_findings.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Only scans whose URL contains this text, e.g. example.com',
      },
      status: {
        type: 'string',
        enum: ['queued', 'running', 'finished', 'failed'],
        description: 'Filter by scan status',
      },
      limit: {
        type: 'integer',
        description: 'Number of results (default: 20, max: 50)',
        default: 20,
      },
      page: {
        type: 'integer',
        description: 'Page number, starting at 1 (default: 1)',
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
        report_url: s.report_url ?? null,
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
