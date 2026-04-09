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
    const data = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&limit=1`);
    const scans = Array.isArray(data) ? data : (data.data ?? []);

    if (scans.length === 0) {
      throw new Error(`Kein Scan gefunden für Domain: ${domain_url}`);
    }

    const scan = scans[0];
    const findings = (scan.findings ?? []).filter(
      (f) => f.severity === 'bad' || f.severity === 'warning'
    );

    return {
      id: scan.id,
      score: scan.score,
      scanned_at: scan.scanned_at,
      findings,
      top_brakes: scan.top_brakes,
      cwv_metrics: scan.cwv_metrics,
      ttfb: scan.ttfb,
      psi_score_mobile: scan.psi_score_mobile,
      psi_score_desktop: scan.psi_score_desktop,
    };
  },
};
