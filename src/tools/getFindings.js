import { api } from '../api.js';

export const getFindings = {
  name: 'get_findings',
  description: 'Returns all detailed findings of a scan, including recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      scan_id: {
        type: 'string',
        description: 'ID of the scan',
      },
    },
    required: ['scan_id'],
  },
  async handler(token, { scan_id }) {
    const scan = await api.get(token, `/scans/${encodeURIComponent(scan_id)}`);
    const findings = scan.data?.result?.findings ?? [];

    return findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      message: f.message,
      recommendation: f.recommendation,
    }));
  },
};
