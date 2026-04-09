import { api } from '../api.js';

async function getLatestScanDetail(token, domain_url) {
  const listData = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=1`);
  const scans = Array.isArray(listData) ? listData : (listData.data ?? []);
  if (scans.length === 0) throw new Error(`Kein Scan gefunden für: ${domain_url}`);

  const { public_id } = scans[0];
  const detail = await api.get(token, `/scans/${encodeURIComponent(public_id)}`);
  return detail.data?.result ?? {};
}

export const compareDomains = {
  name: 'compare_domains',
  description: 'Vergleicht zwei Domains direkt anhand ihrer neuesten Scan-Daten (Score, TTFB, CWV, Findings).',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url_a: {
        type: 'string',
        description: 'URL der ersten Domain',
      },
      domain_url_b: {
        type: 'string',
        description: 'URL der zweiten Domain',
      },
    },
    required: ['domain_url_a', 'domain_url_b'],
  },
  async handler(token, { domain_url_a, domain_url_b }) {
    const [resultA, resultB] = await Promise.all([
      getLatestScanDetail(token, domain_url_a),
      getLatestScanDetail(token, domain_url_b),
    ]);

    const extract = (result, url) => ({
      domain: url,
      score: result.scores?.overall,
      ttfb_ms: result.metrics?.ttfb_ms,
      findings_count: (result.findings ?? []).length,
      bad_findings: (result.findings ?? []).filter((f) => f.severity === 'bad').length,
      warning_findings: (result.findings ?? []).filter((f) => f.severity === 'warning').length,
    });

    return {
      a: extract(resultA, domain_url_a),
      b: extract(resultB, domain_url_b),
    };
  },
};
