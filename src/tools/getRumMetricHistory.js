import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';
import { findRumSite } from './domain.js';

export const getRumMetricHistory = {
  name: 'get_rum_metric_history',
  title: 'Get RUM metric history',
  description: 'Returns the daily history of one Real User Monitoring metric for a domain: per day the p75 and p50 value and the number of samples, over the last 7, 30 or 90 days, optionally filtered by device. Times are in milliseconds, CLS is unitless. Requires RUM to be set up for the domain.',
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
    const { site, host } = await findRumSite(token, domain_url);

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
