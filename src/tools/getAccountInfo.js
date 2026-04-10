import { api } from '../api.js';

export const getAccountInfo = {
  name: 'get_account_info',
  description: 'Returns account info for the authenticated user: plan, API usage, daily limits, and RUM configuration.',
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
        api_daily_limit: user.plan?.api_daily_limit,
      },
      api_usage: {
        used_today: user.api_usage?.used_today,
        limit_today: user.api_usage?.limit_today,
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
