import { api } from '../api.js';

export const getAlert = {
  name: 'get_alert',
  description: 'Returns details of a single alert.',
  inputSchema: {
    type: 'object',
    properties: {
      alert_id: {
        type: 'string',
        description: 'ID of the alert',
      },
    },
    required: ['alert_id'],
  },
  async handler(token, { alert_id }) {
    const data = await api.get(token, `/alerts/${encodeURIComponent(alert_id)}`);
    return data.data ?? data;
  },
};
