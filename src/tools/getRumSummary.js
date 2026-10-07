import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';
import { findRumSite } from './domain.js';

export const getRumSummary = {
  name: 'get_rum_summary',
  title: 'Get RUM summary',
  description: 'Returns Real User Monitoring (RUM) field data measured in real visitors\' browsers for one domain: p75 value, rating and sample count for LCP, CLS, INP, FCP and TTFB, and whether the site passes Core Web Vitals (null when there are too few samples). Requires the turbometrics RUM snippet on the site and a plan with RUM; for lab measurements use get_latest_scan instead.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'Domain with Real User Monitoring set up, e.g. https://example.com or example.com',
      },
      period: {
        type: 'string',
        enum: ['24h', '7d', '30d'],
        description: "Time period: '24h', '7d' or '30d' (default: '30d')",
        default: '30d',
      },
      device: {
        type: 'string',
        enum: ['all', 'desktop', 'mobile', 'tablet'],
        description: 'Device filter (default: all)',
        default: 'all',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, period = '30d', device = 'all' }) {
    const { site, host } = await findRumSite(token, domain_url);

    const params = new URLSearchParams({ period, device });
    const summary = await api.get(token, `/rum/sites/${site.id}/summary?${params}`);
    return {
      domain: summary.data?.domain ?? host,
      period: summary.data?.period,
      device: summary.data?.device,
      cwv_pass: summary.data?.cwv_pass,
      cwv_insufficient_data: summary.data?.cwv_insufficient_data,
      metrics: summary.data?.metrics,
    };
  },
};
