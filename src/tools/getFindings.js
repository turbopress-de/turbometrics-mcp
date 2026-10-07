import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

export const getFindings = {
  name: 'get_findings',
  title: 'Get scan findings',
  description: 'Returns every finding of one scan in report order: category, check code, severity (good, warning or bad), title, explanation and a concrete recommendation. The scan_id is the public_id returned by get_latest_scan, list_scans or trigger_scan. A scan that is still queued or running has no findings yet.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      scan_id: {
        type: 'string',
        description: 'public_id of the scan, as returned by get_latest_scan, list_scans or trigger_scan',
      },
    },
    required: ['scan_id'],
  },
  async handler(token, { scan_id }) {
    const scan = await api.get(token, `/scans/${encodeURIComponent(scan_id)}`);
    const findings = scan.data?.result?.findings ?? [];

    return findings.map((f) => ({
      category: f.category,
      code: f.code,
      title: f.title,
      severity: f.severity,
      message: f.message,
      recommendation: f.recommendation,
    }));
  },
};
