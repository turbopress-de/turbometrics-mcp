# turbometrics MCP Server

Connect Claude and other AI tools directly to your [turbometrics.de](https://turbometrics.de) account.

## What you can do

Ask your AI assistant questions like:

**Scans & Performance**
- "What's the performance score of turbopress.de?"
- "Which findings does turbometrics.de have?"
- "Has my score improved this week?"
- "Compare turbopress.de with turbometrics.de"
- "Scan https://new-client-site.com and show me the results" *(any URL, even unmonitored ones)*
- "Start a scan for example.com in the EU region"

**Real User Monitoring**
- "Show Core Web Vitals for turbopress.de"
- "How has the LCP of my site trended over the last 30 days?"
- "Which pages on turbopress.de have the worst LCP?"
- "Compare INP this week vs last week"

**Alerts & Account**
- "Show all open alerts"
- "Mark all alerts as read"
- "What plan am I on and how many API requests do I have left today?"

## Requirements

- A turbometrics.de account (Starter plan or higher)
- An API token from [Profile → API](https://turbometrics.de/profile/api)

## Available Tools

| Tool | Description |
|------|-------------|
| `list_domains` | List all monitored URLs with schedule and status |
| `get_latest_scan` | Latest scan result: score, findings, TTFB, Core Web Vitals |
| `get_scan_history` | Score history — works for monitored and new domains |
| `get_findings` | Detailed findings for a specific scan |
| `list_alerts` | List open or resolved alerts |
| `get_rum_summary` | Real User Monitoring summary: Core Web Vitals p75 values |
| `get_rum_metric_history` | Daily trend for a RUM metric (LCP, CLS, INP, FCP, TTFB) |
| `get_rum_pages` | Slowest pages ranked by metric |
| `compare_domains` | Compare two domains side by side |
| `trigger_scan` | Start a scan for any URL — new or monitored; supports region, force, and auth |
| `mark_alerts_read` | Mark alerts as read |
| `get_account_info` | Account details: plan, API limits, RUM status |

## Authentication

Every request requires a Bearer token passed via the `Authorization` header.
Get your token at [turbometrics.de/profile/api](https://turbometrics.de/profile/api).

## Setup

### Claude Desktop (Mac)

1. Install Node.js: `brew install node`
2. Get your API token from [Profile → API](https://turbometrics.de/profile/api)
3. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "turbometrics": {
      "command": "/opt/homebrew/bin/npx",
      "args": [
        "mcp-remote",
        "https://turbometrics.de/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_TOKEN"
      ]
    }
  }
}
```

4. Restart Claude Desktop

### Claude Desktop (Windows)

Same as Mac — find your `npx` path with `where npx` in CMD.

### Other MCP Clients (Cursor, Windsurf, etc.)

| Setting | Value |
|---------|-------|
| Server URL | `https://turbometrics.de/mcp` |
| Transport | Streamable HTTP |
| Auth | `Authorization: Bearer YOUR_API_TOKEN` |

## Plans

API access is available from the **Starter plan** and above.

| Plan | Daily API Limit |
|------|----------------|
| Starter | 1,000 requests |
| Pro | 5,000 requests |
| Agency | Unlimited |
