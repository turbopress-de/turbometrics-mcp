import { api } from '../api.js';

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
    const [dataA, dataB] = await Promise.all([
      api.get(token, `/scans?domain=${encodeURIComponent(domain_url_a)}&limit=1`),
      api.get(token, `/scans?domain=${encodeURIComponent(domain_url_b)}&limit=1`),
    ]);

    const scansA = Array.isArray(dataA) ? dataA : (dataA.data ?? []);
    const scansB = Array.isArray(dataB) ? dataB : (dataB.data ?? []);

    if (scansA.length === 0) throw new Error(`Kein Scan gefunden für: ${domain_url_a}`);
    if (scansB.length === 0) throw new Error(`Kein Scan gefunden für: ${domain_url_b}`);

    const a = scansA[0];
    const b = scansB[0];

    const extract = (scan, url) => ({
      domain: url,
      score: scan.score,
      ttfb: scan.ttfb,
      lcp: scan.cwv_metrics?.lcp,
      cls: scan.cwv_metrics?.cls,
      tbt: scan.cwv_metrics?.tbt,
      findings_count: (scan.findings ?? []).length,
      bad_findings: (scan.findings ?? []).filter((f) => f.severity === 'bad').length,
    });

    return {
      a: extract(a, domain_url_a),
      b: extract(b, domain_url_b),
    };
  },
};
