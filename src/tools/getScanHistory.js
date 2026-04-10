import { api } from '../api.js';

async function findDomainId(token, domain_url) {
  let page = 1;
  const inputHost = new URL(domain_url).hostname;
  while (true) {
    const data = await api.get(token, `/domains?page=${page}&limit=50`);
    const items = data.data ?? [];
    const found = items.find((d) => new URL(d.url).hostname === inputHost);
    if (found) return found.id;
    if (page >= (data.meta?.last_page ?? 1)) break;
    page++;
  }
  return null;
}

export const getScanHistory = {
  name: 'get_scan_history',
  description: 'Returns the score history of a domain for trend analysis. Works for both monitored domains and any URL that has been scanned before.',
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
    // Preferred: monitored domain history endpoint (clean score data, up to 30 entries)
    const domainId = await findDomainId(token, domain_url);
    if (domainId) {
      const historyData = await api.get(token, `/domains/${domainId}/history`);
      const entries = historyData.data ?? [];
      return entries.map((e) => ({
        score: e.score,
        created_at: e.created_at,
        region: e.region,
      }));
    }

    // Fallback: scans endpoint — works for new/unmonitored domains
    let page = 1;
    const entries = [];
    while (true) {
      const data = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=50&page=${page}`);
      const items = data.data ?? [];
      for (const scan of items) {
        entries.push({
          scan_id: scan.id ?? scan.public_id,
          score: scan.score ?? null,
          created_at: scan.created_at,
          region: scan.region ?? null,
        });
      }
      if (items.length === 0 || page >= (data.meta?.last_page ?? 1)) break;
      page++;
    }

    if (entries.length === 0) {
      throw new Error(`Keine Scans gefunden für: ${domain_url}`);
    }
    return entries;
  },
};
