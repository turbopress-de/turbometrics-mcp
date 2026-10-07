import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

async function getLatestScanDetail(token, domain_url) {
  const listData = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=1`);
  const scans = Array.isArray(listData) ? listData : (listData.data ?? []);
  if (scans.length === 0) throw new Error(`No finished scan found for ${domain_url}. Start one with trigger_scan.`);

  const { public_id } = scans[0];
  const detail = await api.get(token, `/scans/${encodeURIComponent(public_id)}`);
  return {
    public_id,
    report_url: detail.data?.report_url ?? null,
    finished_at: detail.data?.finished_at ?? null,
    result: detail.data?.result ?? {},
  };
}

// Nur die Laborwerte, die sich nebeneinander sinnvoll vergleichen lassen.
function labMetrics(device) {
  if (!device) return null;
  return {
    lcp_ms: device.lcp_ms ?? null,
    fcp_ms: device.fcp_ms ?? null,
    cls: device.cls ?? null,
    tbt_ms: device.tbt_ms ?? null,
  };
}

export const compareDomains = {
  name: 'compare_domains',
  title: 'Compare two domains',
  description: 'Compares the latest finished scans of two domains side by side: overall and category scores, TTFB, lab metrics for desktop and mobile (LCP, FCP, CLS, TBT), and how many findings are rated bad or warning. Both domains need at least one finished scan by the user; start missing ones with trigger_scan first.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain_url_a: {
        type: 'string',
        description: 'First domain or URL, e.g. https://example.com',
      },
      domain_url_b: {
        type: 'string',
        description: 'Second domain or URL, e.g. https://example.org',
      },
    },
    required: ['domain_url_a', 'domain_url_b'],
  },
  async handler(token, { domain_url_a, domain_url_b }) {
    const [scanA, scanB] = await Promise.all([
      getLatestScanDetail(token, domain_url_a),
      getLatestScanDetail(token, domain_url_b),
    ]);

    const extract = ({ public_id, report_url, finished_at, result }, url) => ({
      domain: url,
      public_id,
      report_url,
      finished_at,
      score: result.scores?.overall,
      scores: result.scores ?? {},
      ttfb_ms: result.metrics?.ttfb_ms,
      desktop: labMetrics(result.metrics?.desktop),
      mobile: labMetrics(result.metrics?.mobile),
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
