import { api } from '../api.js';

export const getFindings = {
  name: 'get_findings',
  description: 'Gibt alle detaillierten Findings eines Scans zurück, inklusive Empfehlungen.',
  inputSchema: {
    type: 'object',
    properties: {
      scan_id: {
        type: 'string',
        description: 'ID des Scans',
      },
    },
    required: ['scan_id'],
  },
  async handler(token, { scan_id }) {
    const scan = await api.get(token, `/scans/${encodeURIComponent(scan_id)}`);
    const findings = scan.findings ?? [];

    return findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      message: f.message,
      recommendation: f.recommendation,
    }));
  },
};
