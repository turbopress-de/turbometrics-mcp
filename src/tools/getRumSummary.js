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
      period: {
        type: 'string',
        enum: ['24h', '7d', '30d'],
        description: "Zeitraum: '24h', '7d' oder '30d' (Standard: '30d')",
        default: '30d',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, period = '30d' }) {
    const sitesData = await api.get(token, '/rum/sites');
    const sites = Array.isArray(sitesData) ? sitesData : (sitesData.data ?? []);

    const site = sites.find(
      (s) => s.domain === domain_url || s.url === domain_url
    );
    if (!site) {
      throw new Error(`RUM-Site nicht gefunden für Domain: ${domain_url}`);
    }

    const summary = await api.get(token, `/rum/sites/${site.id}/summary?period=${encodeURIComponent(period)}`);
    const data = summary.data ?? summary;

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
