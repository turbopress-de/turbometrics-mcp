import { api } from '../api.js';

export const triggerScan = {
  name: 'trigger_scan',
  description: 'Startet sofort einen neuen Scan für eine Domain.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain, die gescannt werden soll',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url }) {
    const response = await api.post(token, '/scans', { url: domain_url });
    const result = response.data ?? response;

    return {
      scan_id: result.id ?? result.scan_id,
      status: result.status,
      message: result.message ?? 'Scan wurde gestartet.',
    };
  },
};
