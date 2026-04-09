import { api } from '../api.js';

export const markAlertsRead = {
  name: 'mark_alerts_read',
  description: 'Marks one or more alerts as read.',
  inputSchema: {
    type: 'object',
    properties: {
      alert_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of alert IDs to mark as read',
      },
    },
    required: ['alert_ids'],
  },
  async handler(token, { alert_ids }) {
    const response = await api.post(token, '/alerts/mark-read', { alert_ids });
    const result = response.data ?? response;
    return {
      message: result.message ?? 'Alerts wurden als gelesen markiert.',
      marked_read: result.marked_read ?? alert_ids.length,
    };
  },
};
