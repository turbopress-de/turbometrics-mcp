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
    const domains = [];
    let page = 1;
    while (true) {
      const data = await api.get(token, `/domains?page=${page}&limit=50`);
      const items = data.data ?? [];
      domains.push(...items);
      if (page >= (data.meta?.last_page ?? 1)) break;
      page++;
    }

    return domains.map((d) => ({
      host: d.host,
      url: d.url,
      schedule: d.schedule,
      is_active: d.is_active,
      last_dispatched_at: d.last_dispatched_at,
    }));
  },
};
