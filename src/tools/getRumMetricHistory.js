import { api } from '../api.js';

export const getRumMetricHistory = {
  name: 'get_rum_metric_history',
  description: 'Returns daily historical data (p75/p50 values and sample counts) for a specific Core Web Vital metric of a RUM-enabled domain.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain (z.B. https://example.com)',
      },
      metric: {
        type: 'string',
        enum: ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'],
        description: 'Metric to retrieve history for',
      },
      days: {
        type: 'number',
        enum: [7, 30, 90],
        description: 'Number of days to look back (default: 30)',
        default: 30,
      },
      device: {
        type: 'string',
        enum: ['all', 'desktop', 'mobile', 'tablet'],
        description: 'Device filter (default: all)',
        default: 'all',
      },
    },
    required: ['domain_url', 'metric'],
  },
  async handler(token, { domain_url, metric, days = 30, device = 'all' }) {
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

    const params = new URLSearchParams({ metric, days: String(days), device });
    const data = await api.get(token, `/rum/sites/${site.id}/history?${params}`);
    const entries = data.data ?? [];

    return {
      domain: host,
      metric,
      days,
      device,
      history: entries.map((e) => ({
        date: e.date,
        p75: e.p75,
        p50: e.p50,
        samples: e.samples,
      })),
    };
  },
};
