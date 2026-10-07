import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

export const listDomains = {
  name: 'list_domains',
  title: 'List monitored domains',
  description: 'Lists all domains the user monitors in turbometrics with scheduled scans: host, URL, scan schedule, whether monitoring is active, and when the last scheduled scan was dispatched. Use the url values as domain_url for get_latest_scan, get_scan_history or compare_domains.',
  annotations: READ_ONLY,
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
