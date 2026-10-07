import { api } from '../api.js';
import { READ_ONLY } from './annotations.js';

/**
 * Die API meldet ein unbegrenztes Tageskontingent als 0 (ApiAccountController
 * castet null zu int). Wer hier ueberhaupt ankommt, hat API-Zugang — 0 heisst
 * also "unbegrenzt", nicht "aufgebraucht". Als null weitergeben, sonst liest
 * das Modell daraus ein erschoepftes Kontingent.
 */
function dailyLimit(value) {
  return value === 0 || value === undefined ? null : value;
}

export const getAccountInfo = {
  name: 'get_account_info',
  title: 'Get account info',
  description: 'Returns information about the connected turbometrics account: name and email, current plan, API calls used today against the daily limit (null means unlimited; with reset time), and Real User Monitoring status (enabled, number of sites, pageviews this month and monthly limit). Useful to explain why a call was rejected by a plan limit.',
  annotations: READ_ONLY,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async handler(token) {
    const data = await api.get(token, '/me');
    const user = data.data ?? data;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: {
        key: user.plan?.key,
        label: user.plan?.label,
        api_daily_limit: dailyLimit(user.plan?.api_daily_limit),
      },
      api_usage: {
        used_today: user.api_usage?.used_today,
        limit_today: dailyLimit(user.api_usage?.limit_today),
        reset_at: user.api_usage?.reset_at,
      },
      rum: {
        enabled: user.rum?.enabled ?? false,
        sites_count: user.rum?.sites_count ?? 0,
        monthly_limit: user.rum?.monthly_limit ?? 0,
        pageviews_this_month: user.rum?.pageviews_this_month ?? 0,
      },
    };
  },
};
