import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';
import { latestFinishedScan } from './domain.js';

export const getLatestScan = {
  name: 'get_latest_scan',
  title: 'Get latest scan',
  description: 'Returns the most recent finished scan of a domain from the user\'s own scans: scores (overall, speed, images, caching, wordpress, technical; 0-100), lab metrics (TTFB plus FCP, LCP, CLS and TBT for desktop and mobile), the findings rated bad or warning, a short summary and a link to the full report. Does not start a new scan; use trigger_scan for that. For all findings including passed checks, call get_findings with the returned public_id.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'Domain or URL as it was scanned, e.g. https://example.com or example.com',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url }) {
    const { public_id, submitted_url } = await latestFinishedScan(token, domain_url);

    const detail = await api.get(token, `/scans/${encodeURIComponent(public_id)}`);
    const result = detail.data?.result ?? {};

    return {
      public_id: detail.data?.public_id ?? public_id,
      // Damit das Modell sieht, welche Adresse tatsaechlich gescannt wurde.
      submitted_url: detail.data?.submitted_url ?? submitted_url ?? null,
      // Link auf den Report in der Oberflaeche. Kommt aus der API, damit das
      // URL-Schema nicht hier nachgebaut werden muss.
      report_url: detail.data?.report_url ?? null,
      finished_at: detail.data?.finished_at ?? null,
      scores: result.scores ?? {},
      // Vorher nur ttfb_ms, obwohl die Beschreibung Core Web Vitals versprach.
      // Die API liefert desktop/mobile mit FCP, LCP, CLS und TBT mit.
      metrics: result.metrics ?? {},
      findings: (result.findings ?? []).filter((f) =>
        ['bad', 'warning'].includes(f.severity)
      ),
      summary_short: result.summary_short,
    };
  },
};
