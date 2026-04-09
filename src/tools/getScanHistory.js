import { api } from '../api.js';

async function findDomainId(token, domain_url) {
  let page = 1;
  while (true) {
    const data = await api.get(token, `/domains?page=${page}&limit=50`);
    const items = data.data ?? [];
    const found = items.find((d) => d.url === domain_url);
    if (found) return found.id;
    if (page >= (data.meta?.last_page ?? 1)) break;
    page++;
  }
  return null;
}

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
    const domainId = await findDomainId(token, domain_url);
    if (!domainId) {
      throw new Error(`Domain nicht gefunden: ${domain_url}`);
    }

    const historyData = await api.get(token, `/domains/${domainId}/history`);
    const entries = historyData.data ?? [];

    return entries.map((e) => ({
      score: e.score,
      created_at: e.created_at,
      region: e.region,
    }));
  },
};
