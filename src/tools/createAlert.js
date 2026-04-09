import { api } from '../api.js';

export const markAlertsRead = {
  name: 'mark_alerts_read',
  description: 'Markiert einen oder mehrere Alerts als gelesen.',
  inputSchema: {
    type: 'object',
    properties: {
      alert_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Liste der Alert-IDs, die als gelesen markiert werden sollen',
      },
    },
    required: ['alert_ids'],
  },
  async handler(token, { alert_ids }) {
    const result = await api.post(token, '/alerts/mark-read', { alert_ids });
    return {
      message: result.message ?? 'Alerts wurden als gelesen markiert.',
    };
  },
};
