# turbometrics MCP Server

Connect Claude and other AI tools directly to your [turbometrics.io](https://turbometrics.io) account.

## What you can do

Ask your AI assistant questions like:

**Scans & Performance**
- "What's the performance score of turbopress.de?"
- "Which findings does turbometrics.io have?"
- "Has my score improved this week?"
- "Compare turbopress.de with turbometrics.io"
- "Scan https://new-client-site.com and show me the results" *(any URL, even unmonitored ones)*
- "Start a scan for example.com in the EU region"

**Real User Monitoring**
- "Show Core Web Vitals for turbopress.de"
- "How has the LCP of my site trended over the last 30 days?"
- "Which pages on turbopress.de have the worst LCP?"
- "Compare INP this week vs last week"

**Alerts & Account**
- "Show all open alerts"
- "List my recent scans filtered by status"
- "Show details for alert #123"
- "Mark all alerts as read"
- "What plan am I on and how many API requests do I have left today?"

## Requirements

- A turbometrics.io account (Starter plan or higher)

That's it. Sign-in happens in your browser — there is no token to copy.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_domains` | List all monitored URLs with schedule and status |
| `get_latest_scan` | Latest scan result: score, findings, TTFB, Core Web Vitals, report link |
| `get_scan_history` | Score history — works for monitored and new domains |
| `get_findings` | Detailed findings for a specific scan |
| `list_alerts` | List open or resolved alerts |
| `get_rum_summary` | Real User Monitoring summary: Core Web Vitals p75 values |
| `get_rum_metric_history` | Daily trend for a RUM metric (LCP, CLS, INP, FCP, TTFB) |
| `get_rum_pages` | Slowest pages ranked by metric |
| `compare_domains` | Compare two domains side by side, with a report link for each |
| `trigger_scan` | Start a scan for any URL — new or monitored; supports region, force, and auth |
| `list_scans` | List scans — filterable by domain, status and page, with report links |
| `get_alert` | Get details for a specific alert |
| `mark_alerts_read` | Mark alerts as read |
| `get_account_info` | Account details: plan, API limits, RUM status |

## Authentication

OAuth 2.1 with PKCE. Your client sends you to turbometrics.io, you approve once,
and the client holds the token from then on. Access tokens last an hour and are
renewed in the background; you can revoke any connected app at any time under
[Profile → API & apps](https://turbometrics.io/profile/api).

Clients that do not speak OAuth can still authenticate with a personal API
token from the same page, sent as `Authorization: Bearer YOUR_API_TOKEN`.

## Setup

### Claude (recommended)

Claude supports custom connectors straight from the UI — no Node.js, no `npx`,
no config file to edit.

1. In Claude: **Settings → Connectors → "Add custom connector"**
2. Enter:
   - **Name:** `turbometrics`
   - **URL:** `https://turbometrics.io/mcp`
3. Click **"Add"**, then **"Connect"**
4. Approve the access in the browser window that opens

Use `.io`, not `.de` — the sign-in lives only on `turbometrics.io`, and a
connector pointed at the other domain cannot authorise itself.

The connector applies to your whole Claude account — claude.ai, desktop app and
mobile apps alike.

### Claude Code

```bash
claude mcp add --transport http turbometrics https://turbometrics.io/mcp
```

The browser opens for sign-in on first use.

### ChatGPT

Developer mode is in beta and requires ChatGPT Plus or Pro.

1. Enable **Settings → Developer Mode**
2. **Apps & Connectors → create a new connector**
3. Server URL: `https://turbometrics.io/mcp`
4. Choose OAuth as the authentication method and approve in the browser

### Other MCP clients (Cursor, Windsurf, etc.)

| Setting | Value |
|---------|-------|
| Server URL | `https://turbometrics.io/mcp` |
| Transport | Streamable HTTP |
| Auth | OAuth 2.1 (discovery is automatic), or `Authorization: Bearer YOUR_API_TOKEN` |

### Fallback: local setup via `mcp-remote`

Only needed for clients without a connector UI, or for older Claude/ChatGPT
desktop versions. `mcp-remote` performs the OAuth flow itself — no token in the
config file. Requires Node.js (`brew install node`, or the installer from
[nodejs.org](https://nodejs.org/en/download)).

`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "turbometrics": {
      "command": "/opt/homebrew/bin/npx",
      "args": [
        "mcp-remote",
        "https://turbometrics.io/mcp"
      ]
    }
  }
}
```

Adjust the `npx` path to your system (`which npx` on Mac, `where npx` in CMD on
Windows), then restart the client.

Step-by-step instructions for every client: [turbometrics.io/docs/mcp](https://turbometrics.io/docs/mcp)

## Plans

API access is available from the **Starter plan** and above.

| Plan | Daily API Limit |
|------|----------------|
| Starter | 1,000 requests |
| Pro | 5,000 requests |
| Agency | Unlimited |
