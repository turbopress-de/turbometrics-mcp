import { api } from '../api.js';

export const createAlert = {
  name: 'create_alert',
  description: 'Legt eine neue Alert-Regel für eine Domain an.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL der Domain',
      },
      metric: {
        type: 'string',
        description: 'Metrik, auf die der Alert reagiert (z.B. score, ttfb, lcp)',
      },
      warning_threshold: {
        type: 'number',
        description: 'Schwellenwert für Warning',
      },
      critical_threshold: {
        type: 'number',
        description: 'Schwellenwert für Critical',
      },
    },
    required: ['domain_url', 'metric', 'warning_threshold', 'critical_threshold'],
  },
  async handler(token, { domain_url, metric, warning_threshold, critical_threshold }) {
    const result = await api.post(token, '/alerts', {
      domain_url,
      metric,
      warning_threshold,
      critical_threshold,
    });

    return {
      alert_id: result.id ?? result.alert_id,
      message: result.message ?? 'Alert wurde angelegt.',
    };
  },
};
