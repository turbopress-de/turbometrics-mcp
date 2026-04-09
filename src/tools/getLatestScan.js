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
    const result = detail.result ?? listResult ?? {};

    const findings = (result.findings ?? []).filter(
      (f) => f.severity === 'bad' || f.severity === 'warning'
    );

    return {
      public_id,
      scores: result.scores ?? {},
      metrics: {
        ttfb: result.ttfb,
        psi_score_mobile: result.psi_score_mobile,
        psi_score_desktop: result.psi_score_desktop,
        cwv_mobile: result.cwv_mobile,
        cwv_desktop: result.cwv_desktop,
      },
      findings,
      summary_short: result.summary_short,
    };
  },
};
