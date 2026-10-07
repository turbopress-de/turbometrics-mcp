import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';
import { findRumSite } from './domain.js';

export const getRumPages = {
  name: 'get_rum_pages',
  title: 'Get slowest RUM pages',
  description: 'Returns the slowest pages of a domain by Real User Monitoring data, worst first: path, p75 value in milliseconds and sample count for LCP, FCP or TTFB over the last 24 hours or 7 days. Use it to find which URLs drag the site\'s Core Web Vitals down. Requires RUM to be set up for the domain.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'Domain with Real User Monitoring set up, e.g. https://example.com or example.com',
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
        type: 'integer',
        description: 'Number of pages to return, 1–100 (default: 25)',
        default: 25,
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, metric = 'LCP', period = '24h', limit = 25 }) {
    const { site, host } = await findRumSite(token, domain_url);

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
