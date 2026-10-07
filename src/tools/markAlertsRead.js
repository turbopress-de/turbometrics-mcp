import { api } from '../api.js';

// Obergrenze je Aufruf. Die API kennt keine, aber ein Modell, das "alle"
// markieren will, soll das ueber mehrere bewusste Aufrufe tun.
const MAX_IDS = 100;

/**
 * Die API (ApiAlertController::markRead) erwartet 'ids' als Ganzzahlen und
 * markiert ALLE ungelesenen Alerts des Kontos, wenn 'ids' fehlt oder leer ist.
 * Bis 1.5.0 schickte dieses Werkzeug 'alert_ids' — die API sah also nie eine
 * Auswahl, und "markiere Alert 12 als gelesen" markierte jeden Alert.
 *
 * Deshalb wird hier streng geprueft: keine leere Liste, nur positive
 * Ganzzahlen. Ein leeres 'ids' darf die API nie erreichen.
 */
function checkIds(alert_ids) {
  if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
    throw new Error('alert_ids must be a non-empty list of alert IDs.');
  }

  if (alert_ids.length > MAX_IDS) {
    throw new Error(`At most ${MAX_IDS} alert IDs per call.`);
  }

  // Die Umwandlung von "12" in 12 greift nur bei direktem Aufruf (Tests,
  // kuenftige Aufrufer); ueber MCP prueft das zod-Schema vorher auf Ganzzahlen.
  return alert_ids.map((raw) => {
    const id = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;

    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`Invalid alert ID: ${JSON.stringify(raw)}. Use the numeric id from list_alerts.`);
    }

    return id;
  });
}

export const markAlertsRead = {
  name: 'mark_alerts_read',
  title: 'Mark alerts as read',
  description: 'Marks the given alerts as read in the user\'s turbometrics account. Only the listed IDs are changed; alerts already read are left as they are. This does not resolve or delete an alert, it only clears the unread state. Returns how many alerts changed.',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    type: 'object',
    properties: {
      alert_ids: {
        type: 'array',
        items: { type: 'integer' },
        description: `Numeric alert IDs from list_alerts, 1 to ${MAX_IDS} per call`,
      },
    },
    required: ['alert_ids'],
  },
  async handler(token, { alert_ids }) {
    const ids = checkIds(alert_ids);

    const response = await api.post(token, '/alerts/mark-read', { ids });
    const result = response?.data ?? response ?? {};

    return {
      marked_read: result.marked_read ?? 0,
      requested: ids.length,
    };
  },
};
