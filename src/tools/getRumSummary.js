import { api } from '../api.js';

export const getRumSummary = {
  name: 'get_rum_summary',
  description: 'Gibt Real User Monitoring (RUM) Daten einer Domain zurück: Core Web Vitals, Pageviews, Browser- und Referrer-Verteilung.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain (z.B. https://example.com)',
      },
      days: {
        type: 'number',
        description: 'Zeitraum in Tagen (Standard: 30)',
        default: 30,
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, days = 30 }) {
    const data = await api.get(
      token,
      `/rum/summary?domain=${encodeURIComponent(domain_url)}&days=${days}`
    );

    return {
      lcp_p75: data.lcp_p75,
      cls_p75: data.cls_p75,
      inp_p75: data.inp_p75,
      pageviews: data.pageviews,
      top_browsers: data.top_browsers,
      top_referrers: data.top_referrers,
    };
  },
};
