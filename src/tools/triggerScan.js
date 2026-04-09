import { api } from '../api.js';

export const triggerScan = {
  name: 'trigger_scan',
  description: 'Starts an immediate scan for any URL — including completely new domains not yet monitored. Returns a scan_id usable with get_findings once the scan completes.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL to scan (e.g. https://example.com)',
      },
      region: {
        type: 'string',
        enum: ['eu', 'us', 'asia'],
        description: 'Scan region (optional)',
      },
      force: {
        type: 'boolean',
        description: 'Force a fresh scan even if a recent cached result exists',
      },
      auth: {
        type: 'object',
        description: 'Optional authentication: {type: "basic", username, password} or {type: "header", header_name, header_value}',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, region, force, auth }) {
    const body = { url: domain_url };
    if (region !== undefined) body.region = region;
    if (force !== undefined) body.force = force;
    if (auth !== undefined) body.auth = auth;

    const response = await api.post(token, '/scans', body);
    const result = response.data ?? response;

    return {
      scan_id: result.id ?? result.scan_id,
      status: result.status,
      cached: result.cached ?? false,
      message: result.cached
        ? 'Cached result returned — use force:true to trigger a fresh scan.'
        : 'Scan queued. Use get_findings(scan_id) or get_latest_scan(url) once complete.',
    };
  },
};
