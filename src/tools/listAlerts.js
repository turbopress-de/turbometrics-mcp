import { api } from '../api.js';

export const listAlerts = {
  name: 'list_alerts',
  description: 'Listet Alerts auf — offene, gelöste oder alle.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['open', 'resolved', 'all'],
        description: "Filter nach Status: 'open', 'resolved' oder 'all' (Standard: 'open')",
        default: 'open',
      },
    },
    required: [],
  },
  async handler(token, { status = 'open' }) {
    const query = status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const data = await api.get(token, `/alerts${query}`);
    const alerts = Array.isArray(data) ? data : (data.data ?? []);

    return alerts.map((a) => ({
      id: a.id,
      domain: a.domain,
      metric: a.metric,
      threshold: a.threshold,
      triggered_at: a.triggered_at,
      resolved_at: a.resolved_at,
    }));
  },
};
