import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';
import { hostOf } from './domain.js';

async function findDomainId(token, host) {
  let page = 1;
  while (true) {
    const data = await api.get(token, `/domains?page=${page}&limit=50`);
    const items = data.data ?? [];
    const found = items.find((d) => hostOf(d.url) === host);
    if (found) return found.id;
    if (page >= (data.meta?.last_page ?? 1)) break;
    page++;
  }
  return null;
}

// Der Rueckgriff ueber /scans darf nicht ungebremst blaettern: bei einer oft
// gescannten URL waeren das beliebig viele API-Aufrufe fuer eine Antwort.
const MAX_FALLBACK_PAGES = 4;

export const getScanHistory = {
  name: 'get_scan_history',
  title: 'Get score history',
  description: 'Returns the overall score over time for trend analysis, newest first. For a monitored domain (see list_domains) these are the last 30 finished scans; for any other URL the user has scanned before, up to 200 finished scans. Each entry has the score (0-100), timestamp and scan region.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'Domain or URL, e.g. https://example.com or example.com',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url }) {
    const host = hostOf(domain_url);

    // Preferred: monitored domain history endpoint (clean score data, up to 30 entries)
    const domainId = await findDomainId(token, host);
    if (domainId) {
      const historyData = await api.get(token, `/domains/${domainId}/history`);
      const entries = historyData.data ?? [];
      return entries.map((e) => ({
        score: e.score,
        created_at: e.created_at,
        region: e.region,
      }));
    }

    // Fallback: scans endpoint — works for new/unmonitored domains. Die Felder
    // folgen ScanListResource: public_id, finished_at, result.scores.overall.
    // Bis 1.5.0 las der Code id, score und created_at, die es dort nicht gibt
    // — jeder Eintrag kam leer zurueck.
    let page = 1;
    const entries = [];
    while (page <= MAX_FALLBACK_PAGES) {
      const data = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&status=finished&limit=50&page=${page}`);
      const items = data.data ?? [];
      for (const scan of items) {
        entries.push({
          scan_id: scan.public_id,
          score: scan.result?.scores?.overall ?? null,
          created_at: scan.finished_at ?? scan.requested_at ?? null,
          region: scan.region ?? null,
        });
      }
      if (items.length === 0 || page >= (data.meta?.last_page ?? 1)) break;
      page++;
    }

    if (entries.length === 0) {
      throw new Error(`No finished scans found for ${domain_url}.`);
    }
    return entries;
  },
};
