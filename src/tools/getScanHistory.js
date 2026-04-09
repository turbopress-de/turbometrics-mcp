import { api } from '../api.js';

export const getScanHistory = {
  name: 'get_scan_history',
  description: 'Gibt den Score-Verlauf einer Domain zurück (bis zu 90 Tage) für Trend-Analysen.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain (z.B. https://example.com)',
      },
      days: {
        type: 'number',
        description: 'Anzahl der Tage (Standard: 30, max: 90)',
        default: 30,
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, days = 30 }) {
    const limit = Math.min(Math.max(1, days), 90);
    const data = await api.get(token, `/scans?domain=${encodeURIComponent(domain_url)}&limit=${limit}`);
    const scans = Array.isArray(data) ? data : (data.data ?? []);

    return scans.map((s) => ({
      date: s.scanned_at,
      score: s.score,
    }));
  },
};
