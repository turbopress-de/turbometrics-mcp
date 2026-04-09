import { api } from '../api.js';

export const getLatestScan = {
  name: 'get_latest_scan',
  description: 'Gibt den neuesten Scan einer Domain zurück, inklusive Score, Findings und Core Web Vitals.',
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
    const listData = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=1`);
    const scans = Array.isArray(listData) ? listData : (listData.data ?? []);

    if (scans.length === 0) {
      throw new Error(`Kein fertiger Scan gefunden für Domain: ${domain_url}`);
    }

    const { public_id, result: listResult } = scans[0];

    const detail = await api.get(token, `/scans/${encodeURIComponent(public_id)}`);
    const result = detail.data?.result ?? {};

    return {
      public_id: detail.data?.public_id ?? public_id,
      scores: result.scores ?? {},
      metrics: {
        ttfb_ms: result.metrics?.ttfb_ms,
      },
      findings: (result.findings ?? []).filter((f) =>
        ['bad', 'warning'].includes(f.severity)
      ),
      summary_short: result.summary_short,
    };
  },
};
