import { api } from '../api.js';

export const getAlert = {
  name: 'get_alert',
  description: 'Gibt Details zu einem einzelnen Alert zurück.',
  inputSchema: {
    type: 'object',
    properties: {
      alert_id: {
        type: 'string',
        description: 'ID des Alerts',
      },
    },
    required: ['alert_id'],
  },
  async handler(token, { alert_id }) {
    const data = await api.get(token, `/alerts/${encodeURIComponent(alert_id)}`);
    return data.data ?? data;
  },
};
