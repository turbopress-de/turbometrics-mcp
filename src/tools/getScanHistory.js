import { api } from '../api.js';

export const getScanHistory = {
  name: 'get_scan_history',
  description: 'Gibt den Score-Verlauf einer Domain zurück für Trend-Analysen.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain (z.B. https://example.com)',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url }) {
    const domainsData = await api.get(token, '/domains');
    const domains = Array.isArray(domainsData) ? domainsData : (domainsData.data ?? []);

    const domain = domains.find(
      (d) => d.url === domain_url || d.host === domain_url
    );
    if (!domain) {
      throw new Error(`Domain nicht gefunden: ${domain_url}`);
    }

    const historyData = await api.get(token, `/domains/${domain.id}/history`);
    const entries = Array.isArray(historyData) ? historyData : (historyData.data ?? []);

    return entries.map((e) => ({
      score: e.score,
      created_at: e.created_at,
      region: e.region,
    }));
  },
};
