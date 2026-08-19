import { api } from '../api.js';

async function getLatestScanDetail(token, domain_url) {
  const listData = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=1`);
  const scans = Array.isArray(listData) ? listData : (listData.data ?? []);
  if (scans.length === 0) throw new Error(`Kein Scan gefunden für: ${domain_url}`);

  const { public_id } = scans[0];
  const detail = await api.get(token, `/scans/${encodeURIComponent(public_id)}`);
  return {
    report_url: detail.data?.report_url ?? null,
    result: detail.data?.result ?? {},
  };
}

export const compareDomains = {
  name: 'compare_domains',
  description: 'Compares two domains directly using their latest scan data (score, TTFB, CWV, findings).',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url_a: {
        type: 'string',
        description: 'URL of the first domain',
      },
      domain_url_b: {
        type: 'string',
        description: 'URL of the second domain',
      },
    },
    required: ['domain_url_a', 'domain_url_b'],
  },
  async handler(token, { domain_url_a, domain_url_b }) {
    const [scanA, scanB] = await Promise.all([
      getLatestScanDetail(token, domain_url_a),
      getLatestScanDetail(token, domain_url_b),
    ]);

    const extract = ({ report_url, result }, url) => ({
      domain: url,
      report_url,
      score: result.scores?.overall,
      ttfb_ms: result.metrics?.ttfb_ms,
      findings_count: (result.findings ?? []).length,
      bad_findings: (result.findings ?? []).filter((f) => f.severity === 'bad').length,
      warning_findings: (result.findings ?? []).filter((f) => f.severity === 'warning').length,
    });

    return {
      a: extract(scanA, domain_url_a),
      b: extract(scanB, domain_url_b),
    };
  },
};
