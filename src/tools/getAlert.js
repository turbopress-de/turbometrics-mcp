import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

export const getAlert = {
  name: 'get_alert',
  title: 'Get alert',
  description: 'Returns one alert in full: type, severity, title, explanation, affected host and URL, related scan ID (usable with get_findings), read and dismissed state, and when it was raised and resolved. Reading an alert does not mark it as read.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      alert_id: {
        type: 'integer',
        description: 'Numeric alert ID from list_alerts',
      },
    },
    required: ['alert_id'],
  },
  async handler(token, { alert_id }) {
    const data = await api.get(token, `/alerts/${encodeURIComponent(alert_id)}`);
    return data.data ?? data;
  },
};
