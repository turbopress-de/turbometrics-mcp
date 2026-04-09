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
        key: user.plan_key,
        label: user.plan_label,
      },
      api_usage: {
        used_today: user.api_requests_today,
        daily_limit: user.api_daily_limit,
      },
      rum: {
        enabled: user.rum_enabled ?? false,
        sites_count: user.rum_sites_count ?? 0,
        monthly_pageviews_limit: user.rum_monthly_pageviews ?? 0,
      },
    };
  },
};
