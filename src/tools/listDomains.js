import { api } from '../api.js';

export const listDomains = {
  name: 'list_domains',
  description: 'Listet alle überwachten Domains mit Status und letztem Scan-Zeitpunkt auf.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler(token, _args) {
    const data = await api.get(token, '/domains');
    const domains = Array.isArray(data) ? data : (data.data ?? []);

    return domains.map((d) => ({
      host: d.host,
      url: d.url,
      schedule: d.schedule,
      is_active: d.is_active,
      last_dispatched_at: d.last_dispatched_at,
    }));
  },
};
