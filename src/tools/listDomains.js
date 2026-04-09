import { api } from '../api.js';

export const listDomains = {
  name: 'list_domains',
  description: 'Listet alle überwachten Domains mit aktuellem Score und Alert-Status auf.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler(token, _args) {
    const data = await api.get(token, '/domains');
    const domains = Array.isArray(data) ? data : (data.data ?? []);

    return domains.map((d) => ({
      name: d.name,
      url: d.url,
      current_score: d.current_score,
      last_scan_at: d.last_scan_at,
      open_alerts_count: d.open_alerts_count,
    }));
  },
};
