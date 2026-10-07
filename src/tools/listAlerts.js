import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

export const listAlerts = {
  name: 'list_alerts',
  title: 'List alerts',
  description: 'Lists the user\'s monitoring alerts, newest first, 50 per page: alert ID, type, severity, title, explanation, affected host and URL, related scan ID, read state, and when it was raised and resolved. Filter by status: open (unresolved and not dismissed, default), unread, resolved or all. Use the id with get_alert or mark_alerts_read.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['open', 'unread', 'resolved', 'all'],
        description: "Filter by status (default: 'open')",
        default: 'open',
      },
      page: {
        type: 'integer',
        description: 'Page number, starting at 1 (default: 1)',
        default: 1,
      },
    },
    required: [],
  },
  async handler(token, { status = 'open', page = 1 }) {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    params.set('limit', '50');
    params.set('page', String(page));

    const data = await api.get(token, `/alerts?${params}`);
    const alerts = Array.isArray(data) ? data : (data.data ?? []);

    // Die Felder folgen ApiAlertController::formatAlert. Bis 1.5.0 las der
    // Code domain, metric, threshold und triggered_at — die gibt es dort
    // nicht, jeder Alert kam bis auf id und resolved_at leer zurueck.
    return {
      alerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        host: a.host,
        url: a.url,
        scan_id: a.scan_id,
        is_read: a.is_read,
        created_at: a.created_at,
        resolved_at: a.resolved_at,
      })),
      meta: {
        total: data.meta?.total ?? null,
        current_page: data.meta?.current_page ?? page,
        last_page: data.meta?.last_page ?? 1,
      },
    };
  },
};
