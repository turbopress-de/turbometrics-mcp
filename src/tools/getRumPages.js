import { api } from '../api.js';

export const getRumPages = {
  name: 'get_rum_pages',
  description: 'Returns the top underperforming pages for a given metric on a RUM-enabled domain (ordered by worst performance).',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain (z.B. https://example.com)',
      },
      metric: {
        type: 'string',
        enum: ['LCP', 'FCP', 'TTFB'],
        description: 'Metric to rank pages by (default: LCP)',
        default: 'LCP',
      },
      period: {
        type: 'string',
        enum: ['24h', '7d'],
        description: 'Time period (default: 24h)',
        default: '24h',
      },
      limit: {
        type: 'number',
        description: 'Number of pages to return, 1–100 (default: 25)',
        default: 25,
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, metric = 'LCP', period = '24h', limit = 25 }) {
    const host = new URL(domain_url).hostname;
    let site = null;
    let page = 1;
    while (!site) {
      const sitesData = await api.get(token, `/rum/sites?page=${page}&limit=50`);
      const items = sitesData.data ?? [];
      site = items.find((s) => s.domain === host) ?? null;
      if (page >= (sitesData.meta?.last_page ?? 1)) break;
      page++;
    }
    if (!site) {
      throw new Error(`RUM-Site nicht gefunden für Domain: ${domain_url}`);
    }

    const params = new URLSearchParams({ metric, period, limit: String(limit) });
    const data = await api.get(token, `/rum/sites/${site.id}/pages?${params}`);
    const pages = data.data ?? [];

    return {
      domain: host,
      metric,
      period,
      pages: pages.map((p) => ({
        path: p.path,
        p75: p.p75,
        samples: p.samples,
      })),
    };
  },
};
